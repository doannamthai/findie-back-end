  
var API = require("../api");
var engine = require("../database/MySql"); 
var async = require('async');
var table = require('../table');

module.exports.init = function (app) {
    app.route(API.PROFILE)
        .get(getProfile)
        .post(updateProfile);
};


function getProfile(req, res){
    let pool = engine.getPool();
    const user_id = req.query.user_id;
    let jsonResult = {};
    pool.query(`select * from ${table.user} where id = ${user_id}`, function(err, result){
        if (err){
            jsonResult.error = err;
        } else {
            jsonResult.result = result[0];
        }
        res.json(jsonResult);
    })
}

function updateProfile(req, res){
    let pool = engine.getPool();
    const body = req.body;
    const user_id = body.id;
    const first_name = body.first_name;
    const last_name = body.last_name;
    const email = body.email;
    const password = body.password;
    let jsonResult = {};
    pool.query(`update ${table.user} set first_name = '${first_name}', last_name = '${last_name}', 
    email = '${email}', password='${password}' where id = ${user_id}`, function(err){
        if (err){
            jsonResult.error = err;
        } else {
            jsonResult.result = "OK";
        }
        res.json(jsonResult);
    })
}