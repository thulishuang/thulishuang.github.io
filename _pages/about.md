---
permalink: /
author_profile: true
redirect_from:
  - /about/
  - /about.html
---

<span class="anchor" id="about-me"></span>

## About Me

Hi! My name is **Shuang Li (李书昂)**. I am currently a researcher at **Tencent** in Beijing. I received my Ph.D. from the [School of Software](https://www.thss.tsinghua.edu.cn/) at [Tsinghua University](https://www.tsinghua.edu.cn/) in 2024, under the supervision of Associate Professor [Lijie Wen](https://www.thss.tsinghua.edu.cn/faculty/wenlijie.htm).

My research interests lie in natural language processing, with a particular focus on **large language models** and **diffusion models**.

### Research Interests

- Large language models
- Diffusion models
- Natural language processing

<span class="anchor" id="news"></span>

## News

- **2026.02**: One paper on subject-driven text-to-image generation was accepted to [CVPR 2026](https://cvpr.thecvf.com/).

<span class="anchor" id="education"></span>

## Education

- **Ph.D. in Software Engineering**, School of Software, Tsinghua University, 2024

<span class="anchor" id="experience"></span>

## Experience

- **Researcher**, Tencent, Beijing
- **Ph.D. Researcher**, School of Software, Tsinghua University

<span class="anchor" id="selected-publications"></span>

## Selected Publications

{% assign recent_pubs = site.publications | sort: "date" | reverse %}
{% for post in recent_pubs limit: 6 %}
  {% include archive-single.html post=post %}
{% endfor %}

A full list is available on [the publications page]({{ '/publications/' | relative_url }}).

<span class="anchor" id="services"></span>

## Services

### Conference Reviewer

- CVPR
- NeurIPS
- ECCV
- ICLR
- ACL
- EMNLP
- NAACL

<span class="anchor" id="contact"></span>

## Contact

- Email: [lishuangthss@gmail.com](mailto:lishuangthss@gmail.com)
- Google Scholar: [profile](https://scholar.google.com/citations?user=LSTOX04AAAAJ&hl=en)
- ResearchGate: [profile](https://www.researchgate.net/profile/Shuang-Li-64)
- Semantic Scholar: [profile](https://www.semanticscholar.org/author/Shuang-Li/2133436155)
