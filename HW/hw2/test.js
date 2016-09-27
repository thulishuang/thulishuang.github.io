describe('startGame',function() {
	it('should be a function',function() {
		assert.isFunction(startGame);
	});
});
describe('pauseGame',function() {
	it('should be a function',function() {
		assert.isFunction(pauseGame);
	});
});
describe('randomGame',function() {
	it('should be a function',function() {
		assert.isFunction(randomGame);
	});
});
describe('help',function() {
	it('should be a function',function() {
		assert.isFunction(help);
	});
});
describe('resetGame',function() {
	it('should be a function',function() {
		assert.isFunction(resetGame);
	});
});
describe('update',function() {
	it('should be a function',function() {
		assert.isFunction(update);
	});
});
describe('drawCell',function() {
	it('should be a function',function() {
		assert.isFunction(drawCell);
	});
	it('should have three arguments',function() {
		assert.equal(drawCell.length,3);
	});
});
describe('LivingRule',function() {
	it('should be a function',function() {
		assert.isFunction(LivingRule);
	});
	it('should have two arguments',function() {
		assert.equal(LivingRule.length,2);
	});
});
