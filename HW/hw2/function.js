	function LifeGame ()
	{
		this.timer = 200;
		this.cellWidth = 10;
		this.cellXNum = 50;
		this.cellYNum = 50;
		this.cells = [];
		this.isRunning = 0;
		this.generation = 0;
		this.livings = 0;
		this.percent = 20.0;
		this.btnStart = $(".btnStart")[0];
		this.btnPause = $(".btnPause")[0];
		this.btnHelp = $(".btnHelp")[0];	
	}
	var life = new LifeGame();


	LifeGame.prototype.startGame = function () {
		life.isRunning = 1;
		life.percent = $(".Percent")[0].value;
		life.btnPause.innerText = "Pause";
		life.randomGame();
		life.btnPause.disabled = false;

		life.update();
	};

	LifeGame.prototype.update = function () {
		var nextGeneration = [];
		var i,j;
		life.livings = 0;
		for(i = 0; i < life.cellXNum; i++){
			for(j = 0; j < life.cellYNum; j++){
				nextGeneration[[i,j]] = life.LivingRule(i,j);
			}
		}
		for(i = 0; i < life.cellXNum; i++){
			for(j = 0; j < life.cellYNum; j++){
				life.cells[[i,j]] = nextGeneration[[i,j]];
			}
		}
		for(i = 0; i < life.cellXNum; i++){
			for(j = 0; j < life.cellYNum; j++){
				if (life.cells[[i,j]] == 1) {
					life.livings++;
				}
				life.drawCell(i,j,life.cells[[i,j]]);
			}
		}
		life.generation++;
		$(".Generation")[0].innerHTML = life.generation;
		$(".Livings")[0].innerHTML = life.livings;
		if (life.isRunning) {
			setTimeout(life.update,life.timer);
		}
	};

	LifeGame.prototype.LivingRule  = function (x,y) {
		var near = [];
		var livingNum = 0;
		near[0] = life.cells[[(x-1+life.cellXNum)%life.cellXNum,(y-1+life.cellYNum)%life.cellYNum]];
		near[1] = life.cells[[x,(y-1+life.cellYNum)%life.cellYNum]];
		near[2] = life.cells[[(x+1+life.cellXNum)%life.cellXNum,(y-1+life.cellYNum)%life.cellYNum]];
		near[3] = life.cells[[(x-1+life.cellXNum)%life.cellXNum,y]];
		near[4] = life.cells[[(x+1+life.cellXNum)%life.cellXNum,y]];
		near[5] = life.cells[[(x-1+life.cellXNum)%life.cellXNum,(y+1+life.cellYNum)%life.cellYNum]];
		near[6] = life.cells[[x,(y+1+life.cellYNum)%life.cellYNum]];
		near[7] = life.cells[[(x+1+life.cellXNum)%life.cellXNum,(y+1+life.cellYNum)%life.cellYNum]];
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
			return life.cells[[x,y]];
		}
		else {
			return 0;
		}
	};
	LifeGame.prototype.loadGame = function () {
		var canvas = $(".Canvas")[0];
		canvas.onmousedown = function (event) {
			if (life.isRunning) {
				return;
			}
			var x = Math.floor(event.offsetX / life.cellWidth);
			var y = Math.floor(event.offsetY / life.cellWidth);
			var isLiving = life.cells[[x,y]];
			if (isLiving && isLiving == 1) {
				life.cells[[x,y]] = 0;
				life.drawCell(x,y,0);
			}
			else {
				life.cells[[x,y]] = 1;
				life.drawCell(x,y,1);
			}
		};
		life.randomGame();
	};

	LifeGame.prototype.pauseGame = function () {
		if (life.isRunning == 1) {
			life.isRunning = 0;
			life.btnPause.innerText = "Continue";
			life.update();
			return;
		}
		if (life.isRunning == 0) {
			life.isRunning = 1;
			life.btnPause.innerText = "Pause";
			life.update();
			return;
		}
	};

	LifeGame.prototype.randomGame = function () {
		life.livings = 0;
		for(var i = 0; i < life.cellXNum; i++){
			for(var j = 0; j < life.cellYNum; j++){
				life.cells[[i,j]] = Math.random() > (1 - life.percent / 100)?1:0;
				if (life.cells[[i,j]] == 1) {
					life.livings++;
				}
				life.drawCell(i,j,life.cells[[i,j]]);
			}
		}
	};

	LifeGame.prototype.drawCell = function (x,y,state) {
		var canvas = $(".Canvas")[0];
		var cxt = canvas.getContext("2d");
		if (state && state == 1) {
			cxt.fillStyle = "Black";
			cxt.fillRect(x*life.cellWidth,y*life.cellWidth,life.cellWidth,life.cellWidth);
			cxt.strokeStyle = "White";
			cxt.strokeRect(x*life.cellWidth+1,y*life.cellWidth+1,life.cellWidth-2,life.cellWidth-2);
			return 1;
		}
		else {
			cxt.clearRect(x*life.cellWidth,y*life.cellWidth,life.cellWidth,life.cellWidth);
			return 0;
		}
	};

	LifeGame.prototype.help = function () {
		window.open("http://baike.baidu.com/link?url=ibx7NALvhaoszqqLslPjjNPDkijy0qn-AhERmnddf994dVH_N4WGvTuebC7kpka9ggQVj0bIJC3xYDgVC-ydEbd0MHXEfeSR-xhJwAWbzrGZ83zYOukPBD8IpY1LtC9h");
	};

	life.btnStart.onclick = function () {
		life.startGame();
	};
	life.btnPause.onclick = function () {
		life.pauseGame();
	};
	life.btnHelp.onclick = function () {
		life.help();
	};
	window.addEventListener("load", life.loadGame(),true);