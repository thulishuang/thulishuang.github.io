	var timer = 10;
	var cellWidth = 10;
	var cellXNum = 50;
	var cellYNum = 50;
	var cells = [];
	var isRunning = 0;
	var generation = 0;
	var canvas = $(".Canvas")[0];
	var cxt = canvas.getContext("2d");
	var btnStart = $(".btnStart")[0];
	var btnPause = $(".btnPause")[0];
	var btnRandom = $(".btnRandom")[0];
	var btnHelp = $(".btnHelp")[0];
	var btnReset = $(".btnReset")[0];
	btnStart.onclick = function () {
		startGame();
	};
	btnPause.onclick = function () {
		pauseGame();
	};
	btnRandom.onclick = function () {
		randomGame();
	};
	btnHelp.onclick = function () {
		help();
	};
	btnReset.onclick = function () {
		resetGame();
	};
	window.addEventListener("load", loadGame(),true);

	function startGame () {
		isRunning = 1;
		btnPause.disabled = false;
		btnStart.disabled = true;
		btnRandom.disabled = true;
		btnReset.disabled = true;
		update();
	}

	function update () {
		var nextGeneration = [];
		var i,j;
		for(i = 0; i < cellXNum; i++){
			for(j = 0; j < cellYNum; j++){
				nextGeneration[[i,j]] = LivingRule(i,j);
			}
		}
		for(i = 0; i < cellXNum; i++){
			for(j = 0; j < cellYNum; j++){
				cells[[i,j]] = nextGeneration[[i,j]];
			}
		}
		for(i = 0; i < cellXNum; i++){
			for(j = 0; j < cellYNum; j++){
				drawCell(i,j,cells[[i,j]]);
			}
		}
		generation++;
		$(".Generation")[0].innerHTML = generation;
		if (isRunning) {
			setTimeout(update,timer);
		}
	}

	function LivingRule (x,y) {
		var near = [];
		var livingNum = 0;
		near[0] = cells[[(x-1+cellXNum)%cellXNum,(y-1+cellYNum)%cellYNum]];
		near[1] = cells[[x,(y-1+cellYNum)%cellYNum]];
		near[2] = cells[[(x+1+cellXNum)%cellXNum,(y-1+cellYNum)%cellYNum]];
		near[3] = cells[[(x-1+cellXNum)%cellXNum,y]];
		near[4] = cells[[(x+1+cellXNum)%cellXNum,y]];
		near[5] = cells[[(x-1+cellXNum)%cellXNum,(y+1+cellYNum)%cellYNum]];
		near[6] = cells[[x,(y+1+cellYNum)%cellYNum]];
		near[7] = cells[[(x+1+cellXNum)%cellXNum,(y+1+cellYNum)%cellYNum]];
		for(var i = 0; i < 8; i++){
			var state = near[i];
			if (state && state == 1) {
				livingNum++;
			}
		}
		if (livingNum == 3) {
			return 1;
		}
		else if (livingNum == 2) {
			return cells[[x,y]];
		}
		else {
			return 0;
		}
	}
	function loadGame () {
		canvas.onmousedown = function (event) {
			if (isRunning) {
				return;
			}
			var x = Math.floor(event.offsetX / cellWidth);
			var y = Math.floor(event.offsetY / cellWidth);
			var isLiving = cells[[x,y]];
			if (isLiving && isLiving == 1) {
				cells[[x,y]] = 0;
				drawCell(x,y,0);
			}
			else {
				cells[[x,y]] = 1;
				drawCell(x,y,1);
			}
		};
		randomGame();
		generation = 0;
		$(".Generation")[0].innerHTML = generation;
	}

	function pauseGame () {
		isRunning = 0;
		btnPause.disabled = true;
		btnStart.disabled = false;
		btnRandom.disabled = false;
		btnReset.disabled = false;
	}

	function randomGame () {
		for(var i = 0; i < cellXNum; i++){
			for(var j = 0; j < cellYNum; j++){
				cells[[i,j]] = Math.random() > 0.8?1:0;
				drawCell(i,j,cells[[i,j]]);
			}
		}
	}

	function resetGame () {
		randomGame();
		generation = 0;
		$(".Generation")[0].innerHTML = generation;
	}

	function drawCell (x,y,state) {
		if (state && state == 1) {
			cxt.fillStyle = "Black";
			cxt.fillRect(x*cellWidth,y*cellWidth,cellWidth,cellWidth);
			cxt.strokeStyle = "White";
			cxt.strokeRect(x*cellWidth+1,y*cellWidth+1,cellWidth-2,cellWidth-2);
		}
		else {
			cxt.clearRect(x*cellWidth,y*cellWidth,cellWidth,cellWidth);
		}
	}

	function help () {
		window.open("http://baike.baidu.com/link?url=ibx7NALvhaoszqqLslPjjNPDkijy0qn-AhERmnddf994dVH_N4WGvTuebC7kpka9ggQVj0bIJC3xYDgVC-ydEbd0MHXEfeSR-xhJwAWbzrGZ83zYOukPBD8IpY1LtC9h");
	}
