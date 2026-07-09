#!/usr/bin/env python3
"""Build the static data bundle for the ABC / AgBank airport lounge finder.

Default behavior is intentionally conservative:
- Overseas data is parsed from the official 2026 .xlsx file.
- Domestic data is parsed from a structured reference HTML export if present.
  The 2016 .xls in the parent folder is not used by default because it is old
  and includes internal-looking contact columns.

You can override any source with local paths or URLs. URLs are downloaded at
build time; the web app can also load a JSON/HTML/XLSX URL at runtime.
"""
from __future__ import annotations

import argparse
import datetime as dt
import html
import json
import os
import re
import sys
import tempfile
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional

ROOT = Path(__file__).resolve().parents[1]
PARENT = ROOT.parent

DEFAULT_OVERSEAS_XLSX = PARENT / "W020260702557021741944.xlsx"
DEFAULT_DOMESTIC_HTML = PARENT / "_ref" / "domestic.html"
DEFAULT_OUTPUT = ROOT / "data" / "lounges.json"

OFFICIAL_OVERSEAS_PAGE = "https://www.abchina.com/cn/personalservices/abcpromotion/National/jwgb20260702.htm"
OFFICIAL_OVERSEAS_XLSX = "https://www.abchina.com/cn/personalservices/abcpromotion/National/W020260702557021741944.xlsx"
OFFICIAL_DOMESTIC_PAGE = "https://www.abchina.com/cn/creditcard/cardservices/AirportVIP/"
OFFICIAL_DOMESTIC_PDF = "https://www.abchina.com/cn/creditcard/cardservices/AirportVIP/201512/W020260527598954597427.pdf"
REFERENCE_DOMESTIC_HTML = "https://agbank-visa-lounge-finder.pages.dev/agbank_visa_domestic_lounge_finder"


def clean(value: Any) -> str:
    """Normalize an Excel/HTML value into a compact string."""
    if value is None:
        return ""
    if isinstance(value, float) and value.is_integer():
        value = int(value)
    text = str(value)
    text = text.replace("\u3000", " ").replace("\r", "\n")
    # Join hard-wrapped PDF/Excel lines while preserving paragraph-ish separators.
    text = re.sub(r"[ \t]*\n[ \t]*", " ", text)
    text = re.sub(r"\s+", " ", text).strip()
    if text in {"None", "nan", "-", "--", "---", "——"}:
        return ""
    return text


def split_list(value: str) -> List[str]:
    if not value:
        return []
    parts = re.split(r"[,，、/]+", value)
    return [p.strip() for p in parts if p.strip()]


def make_search_text(row: Dict[str, Any]) -> str:
    keys = [
        "scope",
        "continent",
        "country",
        "province",
        "city",
        "airport",
        "iata",
        "terminal",
        "lounge",
        "departure",
        "security",
        "directions",
        "serviceTime",
        "usage",
        "serviceContent",
        "guestPolicy",
        "note",
    ]
    return " ".join(clean(row.get(k, "")) for k in keys).lower()


def normalize_record(row: Dict[str, Any], prefix: str, index: int) -> Dict[str, Any]:
    record = {
        "id": row.get("id") or f"{prefix}{index}",
        "scope": clean(row.get("scope")),
        "continent": clean(row.get("continent")),
        "country": clean(row.get("country")),
        "province": clean(row.get("province")),
        "city": clean(row.get("city")),
        "airport": clean(row.get("airport")),
        "iata": clean(row.get("iata")),
        "terminal": clean(row.get("terminal")),
        "lounge": clean(row.get("lounge")),
        "departure": clean(row.get("departure")),
        "departureList": row.get("departureList") or split_list(clean(row.get("departure"))),
        "security": clean(row.get("security")),
        "directions": clean(row.get("directions")),
        "serviceTime": clean(row.get("serviceTime")),
        "usage": clean(row.get("usage")),
        "serviceContent": clean(row.get("serviceContent")),
        "guestPolicy": clean(row.get("guestPolicy")),
        "note": clean(row.get("note")),
        "airportNumber": row.get("airportNumber"),
        "locationNumber": row.get("locationNumber"),
        "source": clean(row.get("source")),
    }
    if not record["country"] and record["scope"] == "境内":
        record["country"] = "中国"
    if not record["continent"] and record["scope"] == "境内":
        record["continent"] = "中国"
    if not record["lounge"]:
        record["lounge"] = "机场贵宾厅/休息室" if record["scope"] == "境内" else "贵宾厅/休息室"
    record["searchText"] = make_search_text(record)
    return record


def load_openpyxl():
    try:
        import openpyxl  # type: ignore
    except ImportError as exc:
        raise SystemExit("缺少 openpyxl。请运行：python3 -m pip install -r requirements.txt") from exc
    return openpyxl


def parse_overseas_xlsx(path: Path, source_label: str = "农行官网境外机场贵宾厅列表") -> List[Dict[str, Any]]:
    openpyxl = load_openpyxl()
    wb = openpyxl.load_workbook(path, data_only=True, read_only=True)
    sheet_name = None
    for name in wb.sheetnames:
        if "境外" in name or "贵宾" in name:
            sheet_name = name
            break
    if sheet_name is None:
        sheet_name = wb.sheetnames[0]
    ws = wb[sheet_name]
    rows = ws.iter_rows(values_only=True)
    header = [clean(v) for v in next(rows)]
    header_index = {name: i for i, name in enumerate(header)}

    def get(values: Iterable[Any], key: str) -> str:
        values_list = list(values)
        i = header_index.get(key, -1)
        return clean(values_list[i]) if i >= 0 and i < len(values_list) else ""

    records: List[Dict[str, Any]] = []
    for values in rows:
        values = list(values)
        if not any(clean(v) for v in values):
            continue
        raw = {
            "scope": "境外",
            "continent": get(values, "州"),
            "country": get(values, "国家"),
            "province": "",
            "city": get(values, "城市"),
            "airport": get(values, "站点"),
            "iata": get(values, "三字码"),
            "terminal": get(values, "航站楼"),
            "lounge": get(values, "名称"),
            "departure": get(values, "出发类型"),
            "security": get(values, "安检类型"),
            "directions": get(values, "位置指引"),
            "serviceTime": "",
            "usage": "无需预约，按农行/龙腾出行权益二维码及现场规则核验使用。",
            "serviceContent": "以龙腾出行权益二维码页面及现场实际展示为准。",
            "guestPolicy": "权益细则通常为持卡人本人使用；携伴规则请以对应活动/券码页面为准。",
            "note": "境外及中国港澳台地区指定机场贵宾室，具体以农行/龙腾出行实时展示为准。",
            "source": source_label,
        }
        records.append(normalize_record(raw, "O", len(records) + 1))
    return records


def parse_domestic_html(path: Path, source_label: str = "参考页结构化境内数据；规则以农行官网机场贵宾页为准") -> List[Dict[str, Any]]:
    text = path.read_text(encoding="utf-8", errors="ignore")
    match = re.search(
        r'<script\s+id=["\']lounge-data["\']\s+type=["\']application/json["\']>(.*?)</script>',
        text,
        flags=re.S | re.I,
    )
    if not match:
        raise ValueError(f"未在 {path} 找到 <script id=\"lounge-data\"> 数据")
    payload = html.unescape(match.group(1))
    data = json.loads(payload)
    records: List[Dict[str, Any]] = []
    for item in data:
        raw = dict(item)
        raw["scope"] = clean(raw.get("scope")) or "境内"
        raw["continent"] = clean(raw.get("continent")) or "中国"
        raw["country"] = clean(raw.get("country")) or "中国"
        raw["source"] = clean(raw.get("source")) or source_label
        # Keep only supported fields; normalize IDs/search text below.
        records.append(normalize_record(raw, "D", len(records) + 1))
    return records


def fetch_url(url: str, suffix: str = "") -> Path:
    request = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 AgBankLoungeBuilder/1.0"})
    with urllib.request.urlopen(request, timeout=60) as resp:
        data = resp.read()
    fd, name = tempfile.mkstemp(prefix="agbank-source-", suffix=suffix)
    os.close(fd)
    path = Path(name)
    path.write_bytes(data)
    return path


def find_attachment_url(page_url: str, pattern: str) -> Optional[str]:
    request = urllib.request.Request(page_url, headers={"User-Agent": "Mozilla/5.0 AgBankLoungeBuilder/1.0"})
    html_text = urllib.request.urlopen(request, timeout=60).read().decode("utf-8", errors="ignore")
    for match in re.finditer(r'href=["\']([^"\']+)["\'][^>]*>(.*?)</a>', html_text, flags=re.S | re.I):
        href, label = match.group(1), re.sub(r"<.*?>", "", match.group(2))
        if re.search(pattern, href, re.I) or re.search(pattern, label, re.I):
            return urllib.parse.urljoin(page_url, href)
    return None


def stats_for(records: List[Dict[str, Any]]) -> Dict[str, int]:
    def uniq(key: str, scope: Optional[str] = None) -> int:
        return len({r.get(key, "") for r in records if r.get(key, "") and (scope is None or r.get("scope") == scope)})

    return {
        "records": len(records),
        "domesticRecords": sum(1 for r in records if r.get("scope") == "境内"),
        "overseasRecords": sum(1 for r in records if r.get("scope") == "境外"),
        "airports": uniq("airport"),
        "domesticAirports": uniq("airport", "境内"),
        "overseasAirports": uniq("airport", "境外"),
        "countries": uniq("country"),
        "cities": uniq("city"),
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Build data/lounges.json")
    parser.add_argument("--overseas", default=str(DEFAULT_OVERSEAS_XLSX), help="local overseas .xlsx path")
    parser.add_argument("--overseas-url", help="download overseas .xlsx from this URL before parsing")
    parser.add_argument("--auto-overseas-url", action="store_true", help="discover the current overseas .xlsx URL from the official AgBank page")
    parser.add_argument("--domestic-html", default=str(DEFAULT_DOMESTIC_HTML), help="local domestic structured HTML path")
    parser.add_argument("--domestic-html-url", help="download domestic structured HTML before parsing")
    parser.add_argument("--output", default=str(DEFAULT_OUTPUT), help="output JSON path")
    args = parser.parse_args()

    temp_files: List[Path] = []

    overseas_url = args.overseas_url
    if args.auto_overseas_url:
        overseas_url = find_attachment_url(OFFICIAL_OVERSEAS_PAGE, r"境外机场贵宾厅|\.xlsx") or OFFICIAL_OVERSEAS_XLSX

    if overseas_url:
        overseas_path = fetch_url(overseas_url, ".xlsx")
        temp_files.append(overseas_path)
    else:
        overseas_path = Path(args.overseas)
        overseas_url = OFFICIAL_OVERSEAS_XLSX

    if args.domestic_html_url:
        domestic_path = fetch_url(args.domestic_html_url, ".html")
        temp_files.append(domestic_path)
    else:
        domestic_path = Path(args.domestic_html)

    if not overseas_path.exists():
        raise SystemExit(f"境外 Excel 不存在：{overseas_path}")
    if not domestic_path.exists():
        raise SystemExit(f"境内结构化 HTML 不存在：{domestic_path}\n可先下载参考页，或传入 --domestic-html-url {REFERENCE_DOMESTIC_HTML}")

    overseas_records = parse_overseas_xlsx(overseas_path)
    domestic_records = parse_domestic_html(domestic_path)
    records = domestic_records + overseas_records

    bundle = {
        "metadata": {
            "title": "农行信用卡机场贵宾厅查询",
            "generatedAt": dt.datetime.now(dt.timezone(dt.timedelta(hours=8))).isoformat(timespec="seconds"),
            "generator": "scripts/build_data.py",
            "sources": {
                "domestic": {
                    "kind": "structured-html",
                    "localPath": str(domestic_path),
                    "referenceUrl": REFERENCE_DOMESTIC_HTML,
                    "officialPage": OFFICIAL_DOMESTIC_PAGE,
                    "officialDetailPdf": OFFICIAL_DOMESTIC_PDF,
                    "note": "境内默认数据从结构化参考页提取；服务规则和最终可用性以农行官网/掌银/机场现场为准。",
                },
                "overseas": {
                    "kind": "xlsx",
                    "localPath": str(overseas_path),
                    "officialPage": OFFICIAL_OVERSEAS_PAGE,
                    "officialXlsx": overseas_url or OFFICIAL_OVERSEAS_XLSX,
                    "note": "境外数据来自农行官网附件 Excel；最终以预约短信/龙腾权益二维码实时展示为准。",
                },
            },
            "stats": stats_for(records),
        },
        "records": records,
    }

    out = Path(args.output)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(bundle, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Wrote {out}")
    print(json.dumps(bundle["metadata"]["stats"], ensure_ascii=False, indent=2))

    for path in temp_files:
        try:
            path.unlink()
        except OSError:
            pass


if __name__ == "__main__":
    main()
