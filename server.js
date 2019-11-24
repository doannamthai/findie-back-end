var express = require("express");
var app = express();
var port = process.env.port || 3000;

app.use(express.json())

/** Enable CORS ***/
app.use(function(req, res, next) {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    next();
});


/** Job */
var job = require("./src/job/job");
job.init(app);

/** Auth */
var auth = require("./src/auth/auth");
auth.init(app);

/** Statistic */
var statistic = require("./src/statistic/statistic");
statistic.init(app);

app.listen(port, () => {
 console.log("Server running on port 3000");
});