describe('GameOfLife',function() {
	life = new LifeGame();
	describe('lifeGame',function () {
		it('should be a function',function() {
			assert.isFunction(LifeGame);
		});	
	});
	describe('life.pauseGame',function () {
		it('should be a function',function() {
			assert.isFunction(life.pauseGame);
		});
	});
	describe('life.randomGame',function () {
		it('should be a function',function() {
			assert.isFunction(life.randomGame);
		});
		context('test 100 percent random',function () {
			beforeEach(function () {
				life.percent = 100;
				life.randomGame();
			});
			it('should create 100 percent living cells when the given percent is 100%',function() {
				assert.equal(life.livings,2500);
			});
		});
		context('test 0 percent random',function () {
			beforeEach(function () {
				life.percent = 0;
				life.randomGame();
			});
			it('should create 0 percent living cells when the given percent is 0%',function() {
				assert.equal(life.livings,0);
			});
		});
	});
	describe('life.help',function () {
		it('should be a function',function() {
			assert.isFunction(life.help);
		});
	});
	describe('life.update',function () {
		it('should be a function',function() {
			assert.isFunction(life.update);
		});
	});
	describe('life.drawCell',function () {
		it('should be a function',function() {
			assert.isFunction(life.drawCell);
		});
		it('should have three arguments',function() {
			assert.equal(life.drawCell.length,3);
		});
		context('drawLivingState',function () {
			beforeEach(function () {
				life.cells[[0,0]] = 0;
				life.cells[[0,1]] = 0;
				life.cells[[0,2]] = 0;
				life.cells[[1,0]] = 0;
				life.cells[[1,1]] = 1;
				life.cells[[1,2]] = 0;
				life.cells[[2,0]] = 0;
				life.cells[[2,1]] = 0;
				life.cells[[2,2]] = 0;
			});
			it('should return 1 when the cell is living',function() {
				assert.equal(life.drawCell(1,1,life.cells[[1,1]]),1);
			});
		});
		context('drawDeadState',function () {
			beforeEach(function () {
				life.cells[[0,0]] = 0;
				life.cells[[0,1]] = 0;
				life.cells[[0,2]] = 0;
				life.cells[[1,0]] = 0;
				life.cells[[1,1]] = 0;
				life.cells[[1,2]] = 0;
				life.cells[[2,0]] = 0;
				life.cells[[2,1]] = 0;
				life.cells[[2,2]] = 0;
			});
			it('should return 1 when the cell is living',function() {
				assert.equal(life.drawCell(1,1,life.cells[[1,1]]),0);
			});
		});
	});
	describe('life.LivingRule',function () {

		it('should be a function',function() {
			assert.isFunction(life.LivingRule);
		});
		it('should have two arguments',function() {
			assert.equal(life.LivingRule.length,2);
		});
		context('check The 3 Living Rule',function () {
			beforeEach(function () {
				life.cells[[0,0]] = 1;
				life.cells[[0,1]] = 1;
				life.cells[[0,2]] = 1;
				life.cells[[1,0]] = 0;
				life.cells[[1,1]] = 0;
				life.cells[[1,2]] = 0;
				life.cells[[2,0]] = 0;
				life.cells[[2,1]] = 0;
				life.cells[[2,2]] = 0;
			});
			it('should return 1 when the neighbor living num equals 3',function() {
				assert.equal(life.LivingRule(1,1),1);
			});
		});
		context('check The 2 Living Rule',function () {
			beforeEach(function () {
				life.cells[[0,0]] = 1;
				life.cells[[0,1]] = 0;
				life.cells[[0,2]] = 1;
				life.cells[[1,0]] = 0;
				life.cells[[1,1]] = 0;
				life.cells[[1,2]] = 0;
				life.cells[[2,0]] = 0;
				life.cells[[2,1]] = 0;
				life.cells[[2,2]] = 0;
			});
			it('should not change state when the neighbor living num equals 2',function() {
				assert.equal(life.LivingRule(1,1),0);
			});
		});
		context('check The 1 Living Rule',function () {
			beforeEach(function () {
				life.cells[[0,0]] = 0;
				life.cells[[0,1]] = 0;
				life.cells[[0,2]] = 1;
				life.cells[[1,0]] = 0;
				life.cells[[1,1]] = 1;
				life.cells[[1,2]] = 0;
				life.cells[[2,0]] = 0;
				life.cells[[2,1]] = 0;
				life.cells[[2,2]] = 0;
			});
			it('should die when the neighbor living num equals 1',function() {
				assert.equal(life.LivingRule(1,1),0);
			});
		});
		context('check The 0 Living Rule',function () {
			beforeEach(function () {
				life.cells[[0,0]] = 0;
				life.cells[[0,1]] = 0;
				life.cells[[0,2]] = 0;
				life.cells[[1,0]] = 0;
				life.cells[[1,1]] = 1;
				life.cells[[1,2]] = 0;
				life.cells[[2,0]] = 0;
				life.cells[[2,1]] = 0;
				life.cells[[2,2]] = 0;
			});
			it('should die when the neighbor living num equals 0',function() {
				assert.equal(life.LivingRule(1,1),0);
			});
		});
		context('check The 4 Living Rule',function () {
			beforeEach(function () {
				life.cells[[0,0]] = 1;
				life.cells[[0,1]] = 1;
				life.cells[[0,2]] = 1;
				life.cells[[1,0]] = 1;
				life.cells[[1,1]] = 1;
				life.cells[[1,2]] = 0;
				life.cells[[2,0]] = 0;
				life.cells[[2,1]] = 0;
				life.cells[[2,2]] = 0;
			});
			it('should die when the neighbor living num equals 4',function() {
				assert.equal(life.LivingRule(1,1),0);
			});
		});
		context('check The 5 Living Rule',function () {
			beforeEach(function () {
				life.cells[[0,0]] = 1;
				life.cells[[0,1]] = 1;
				life.cells[[0,2]] = 1;
				life.cells[[1,0]] = 1;
				life.cells[[1,1]] = 1;
				life.cells[[1,2]] = 0;
				life.cells[[2,0]] = 1;
				life.cells[[2,1]] = 0;
				life.cells[[2,2]] = 0;
			});
			it('should die when the neighbor living num equals 5',function() {
				assert.equal(life.LivingRule(1,1),0);
			});
		});
		context('check The 6 Living Rule',function () {
			beforeEach(function () {
				life.cells[[0,0]] = 1;
				life.cells[[0,1]] = 1;
				life.cells[[0,2]] = 1;
				life.cells[[1,0]] = 1;
				life.cells[[1,1]] = 1;
				life.cells[[1,2]] = 1;
				life.cells[[2,0]] = 1;
				life.cells[[2,1]] = 0;
				life.cells[[2,2]] = 0;
			});
			it('should die when the neighbor living num equals 6',function() {
				assert.equal(life.LivingRule(1,1),0);
			});
		});
		context('check The 7 Living Rule',function () {
			beforeEach(function () {
				life.cells[[0,0]] = 1;
				life.cells[[0,1]] = 1;
				life.cells[[0,2]] = 1;
				life.cells[[1,0]] = 1;
				life.cells[[1,1]] = 1;
				life.cells[[1,2]] = 1;
				life.cells[[2,0]] = 1;
				life.cells[[2,1]] = 1;
				life.cells[[2,2]] = 0;
			});
			it('should die when the neighbor living num equals 7',function() {
				assert.equal(life.LivingRule(1,1),0);
			});
		});
		context('check The 8 Living Rule',function () {
			beforeEach(function () {
				life.cells[[0,0]] = 1;
				life.cells[[0,1]] = 1;
				life.cells[[0,2]] = 1;
				life.cells[[1,0]] = 1;
				life.cells[[1,1]] = 1;
				life.cells[[1,2]] = 1;
				life.cells[[2,0]] = 1;
				life.cells[[2,1]] = 1;
				life.cells[[2,2]] = 1;
			});
			it('should die when the neighbor living num equals 8',function() {
				assert.equal(life.LivingRule(1,1),0);
			});
		});
	});
});