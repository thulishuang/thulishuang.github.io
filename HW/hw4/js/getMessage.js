$(function () {

	//初始化信息
	init();

	//连接服务器
	var socket = io.connect('https://wall.cgcgbcbc.com');
	var wall_move = $(".wall_move");

	// 删除第一条消息
	wall_move[0].addEventListener("webkitAnimationEnd", function(e){
		wall_move.removeClass("wall_move");
		var firstChild = wall_move[0].firstElementChild;
		firstChild.remove();
	}, false);

	//监听普通消息
	socket.on("new message", function (data) {
		show_msg(data);
	});

	//监听管理员消息
	socket.on("admin",function (data) {
		var timer = null;
		var adminDiv = null;
		data.headimgurl = "image/admin.jpg";

		if (timer === null) {
			adminDiv = $(".Div").clone()[0];
			adminDiv.className = 'admin';
			getData(adminDiv,data);
			$(".mywall").prepend(adminDiv);
			wall_move[0].firstElementChild.remove();
		}
		
		//当前有管理员消息时，有新管理员消息进来
		else {
			getData(adminDiv,data);
			clearTimeout(timer);
			timer = null;
		}

		//10s后移除管理员信息
		timer = setTimeout(function () {
			var indexData = $('.Div').clone()[0];
			adminDiv.remove();
			wall_move.prepend(indexData);
			adminDiv = indexData;
			adminDiv.className = "Div";
			timer = null;
		}, 10000);
	});

	//显示信息
	function show_msg (data) {
		var dataDiv = $(".Div").clone()[0];
		getData(dataDiv,data);
		wall_move.append(dataDiv);
		wall_move.addClass('wall_move');
		wall_move[0].style.animationPlayState = "running";
	}

	//将data加入到显示块中
	function getData (dataDiv,data) {

		var nickImgDiv = dataDiv.firstElementChild;
		var ImgDiv = nickImgDiv.firstElementChild;
		var nicknameDiv = nickImgDiv.lastElementChild;
		var contentDiv = dataDiv.lastElementChild;

		//图片加载处理
		ImgDiv.firstElementChild.src = data.headimgurl;
		ImgDiv.firstElementChild.onload = function () {
			 ImgDiv.lastElementChild.style.display = 'none';
			 ImgDiv.firstElementChild.style.display = '';
		};

		//判断长度是否需要滚动
		if (data.nickname.length >= 4) {
			nicknameDiv.innerHTML = "<marquee direction='left' scrollamount='30'>" + data.nickname + "</marquee>";
		}
		else {
			nicknameDiv.innerHTML = data.nickname;
		}
		if (data.content.length >= 12) {
			
			contentDiv.innerHTML = "<marquee direction='left' scrollamount='30'>" + data.content + "</marquee>";
		}
		else {
			contentDiv.innerHTML = data.content;
		}
	}
 
	//初始化 获取三条历史消息
	function init () {
		var request = new XMLHttpRequest();
		request.onreadystatechange = function() {
		   if (request.readyState == 4 && request.status == 200) {
		   		var data = JSON.parse(request.responseText);
		   		var dataDiv = $(".Div");
		   		for(var i = 0; i < 3; i++){
		   			getData(dataDiv[i], data[2-i]);
		   		}
		   }
		};
		request.open("GET", "https://wall.cgcgbcbc.com/api/messages?num=3", true);
		request.send(); 
	}
});