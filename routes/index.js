var express = require('express');
var router = express.Router();

// Route to render the main index page
router.get('/', function(req, res, next) {
  res.render('index', { title: 'Express' });
});

module.exports = router;
