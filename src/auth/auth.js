  
var API = require("../api");
var engine = require("../database/MySql"); 
var async = require('async');
var table = require('../table');

module.exports.init = function (app) {
    app.route(API.REGISTER)
        .post(register);
    app.route(API.LOGIN)
        .post(login);
};

function login(req, res){
    let pool = engine.getPool();
    var jsonResult = {};
    let username = req.query.username;
    let password = req.query.password;
    pool.getConnection(function(err, con){
        if (err){
            jsonResult.error = err;
            res.json(jsonResult);
        } else {
            var checkSql = `select * from ${table.user} where username = '${username}' and password='${password}'`;
            con.query(checkSql, function(err, result){
                if (err) jsonResult.error = err;
                else {
                    // This account doesn't exist
                    if (result.length == 0){
                        jsonResult.error = "Wrong username or password. Please try again.";
                    } else {
                        jsonResult.result = result[0];
                    }
                }
                res.json(jsonResult);
                con.release();

            })
        }
    });
}

function register(req, res){
    let pool = engine.getPool();
    var jsonResult = {};
    let username = req.query.username;
    let password = req.query.password;
    let email = req.query.email;
    let first_name = req.query.first_name;
    let last_name = req.query.last_name;

    pool.getConnection(function(err, con){
        if (err){
            jsonResult.error = err;
            res.json(jsonResult);
        } else {
            var checkNameSql = `select count(1) as c from ${table.user} where username = '${username}'`;
            var checkEmailSql = `select count(1) as c from ${table.user} where email = '${email}'`;
            var insert = `insert into ${table.user} (first_name, last_name, password, username, email) 
            VALUE ('${first_name}', '${last_name}', '${password}', '${username}', '${email}')`;
            async.waterfall([
                function (callback) {
                    con.query(checkNameSql, function (err, res) {
                        if (err)
                            callback(err);
                        else{
                            // This records does not exist
                            if (res[0].c == 0){
                                callback(null);
                            } else {
                                callback("This username is already used by other user");
                            }
                        }
                          
                    });
                },
                function (callback) {
                    con.query(checkEmailSql, function (err, res) {
                        if (err)
                            callback(err);
                        else{
                            // This records does not exist
                            if (res[0].c == 0){
                                callback(null);
                            } else {
                                callback("This email is already used by other user");
                            }
                        }
                          
                    });
                },
                function (callback){
                    con.query(insert, function(err){
                        callback(err);
                    })
                }
            ], function(err){
                if (err) jsonResult.error = err;
                else jsonResult.result = "OK";
                res.json(jsonResult);
                con.release();
            })
           
        }
    });
}
