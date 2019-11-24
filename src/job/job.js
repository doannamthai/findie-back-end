  
var API = require("../api");
var engine = require("../database/MySql"); 
var async = require('async');
var table = require('../table');

module.exports.init = function (app) {
    app.route(API.JOB_LISTING)
        .get(getJob);
    app.route(API.JOB_APPLY)
        .post(applyJob);
    app.route(API.SUBMISSION_LISTING).get(getSubmission);
    app.route(API.SUBMISSION_DELETE).post(deleteSubmission);
    app.route(API.SUBMISSION_PROGRESS_UPDATE).post(updateSubmissionProgress);
};

function applyJob(req, res){
    let pool = engine.getPool();
    let user_id = req.query.user_id;
    let position_id = req.query.position_id;
    var jsonResult = {};
    pool.getConnection(function (err, con) {
        if (err) {
            jsonResult.error = err;
            res.json(jsonResult);
            return;
        }
        async.waterfall([
            // Insert into submission
            function (callback) {
                con.query(`insert into ${table.submission}(user_id, position_id) value(${user_id}, ${position_id})`, function (err) {
                    callback(err);
                });
            },
            // Insert into application_progress
            function (callback) {
                con.query(`insert into ${table.application_progress}(submission_id, progress_description, create_time, progress_type) 
            value(LAST_INSERT_ID(), "No description", NOW(), 1)`, function (err) {
                    callback(err);
                });
            },
            // Update applicants number
            function (callback) {
                con.query(`update ${table.position} set application = application + 1 where id = ${position_id}`, function (err) {
                    callback(err);
                });
            }
        ], function (err) {
            if (err) {
                jsonResult.error = err;
            } else {
                jsonResult.result = "OK";
            }
            res.json(jsonResult);
        })
    })
  
}

function updateSubmissionProgress(req, res){
    let pool = engine.getPool();
    let submission_id = req.body.submission_id;
    let progress = req.body.progress;
    var jsonResult = {}
    pool.getConnection(function(err, con){
        if (err) jsonResult.error = err;
        else {
            var insert = function(progress_type, progress_description, create_time){
                return  `insert into ${table.application_progress}(submission_id, progress_type, progress_description, create_time) 
                value (${submission_id}, ${progress_type}, '${progress_description}', '${create_time}')`
            }
            async.waterfall([
                // Delete all the submisson's progress
                function(callback){
                    con.query(`delete from ${table.application_progress} where submission_id = ${submission_id}`, (err) => {
                        callback(err);
                    })
                },
                // Insert
                function(callback){
                    async.each(progress, function(p, inner_callback){
                        con.query(insert(p.progress_type, p.progress_description, p.create_time), (err) => {
                            inner_callback(err);
                        })
                    }, function(err){
                        callback(err);
                    })
                }
            ], function(err){
                if (err)
                    jsonResult.error = err;
                else
                    jsonResult.result = "OK";
                res.json(jsonResult);
                con.release();
            })
        }
    })
}

function deleteSubmission(req, res){
    let pool = engine.getPool();
    let submissions_id = req.body.submissions;
    var jsonResult = {}
    pool.query(`delete from ${table.submission} where id in (${submissions_id})`, (err) =>{
        if (err) jsonResult.error = err;
        else jsonResult.result = "OK";
        res.json(jsonResult);
    })
}

function getSubmission(req, res){
    let pool = engine.getPool();
    let user_id = req.query.user_id;
    var jsonResult = {};
    pool.getConnection(function(err, con){
        if (err){
            jsonResult.error = err;
        } else {
            var generalSelect = function(id){
                return `select s.id, p.id as position_id, p.name, p.description, p.application,
       pt.type_name, p.posted_time, p.deadline, p.location, c.name as company_name, c.image_url from (select *
    from ${table.submission} where id = ${id}) as s
    inner join ${table.position} as p on p.id = s.position_id
    inner join ${table.position_type} as pt on p.position_type = pt.id
    left join ${table.company} as c on c.id = p.company_id`
            }
            var progressSelect = function(id){
                return `select * from ${table.application_progress} as p left join ${table.progress_type} as t on p.progress_type = t.id where p.submission_id = ${id}`
            }
            var data = [];
            async.waterfall([
                // Select submission id
                function(callback){
                    con.query(`select id from ${table.submission} where user_id = ${user_id}`, (err, result) => {
                        if (err) callback(err);
                        else callback(null, result);
                    })
                },
                // Select  info
                function(sub_ids, callback){
                    async.each(sub_ids, function(row, inner_callback){
                        const id = row.id;
                        async.waterfall([
                            // Basic info
                            function (inner_callback2) {
                                con.query(generalSelect(id), (err, result) => {
                                    if (err) inner_callback2(err);
                                    else inner_callback2(null, result[0]);
                                })
                            },
                            // Progress 
                            function (submission, inner_callback2) {
                                con.query(progressSelect(id), (err, result) => {
                                    if (err) inner_callback2(err);
                                    else inner_callback2(null, submission, result);
                                })
                            }
                        ], function(err, submission, progress){
                            if (err) inner_callback(err);
                            else {
                                submission.progress = progress;
                                data.push(submission);
                                inner_callback(null);
                            }
                        })
                    }, function(err){
                        callback(err)
                    })
                    
                }
            ], function(err){
                if (err)
                    jsonResult.error = err;
                else
                    jsonResult.result = data;
                res.json(jsonResult);
                con.release();
            })
        }
    })
}

/** get list of jobs */
function getJob(req, res){
    let pool = engine.getPool();
    var jsonResult = {};
    let limit = req.query.limit == undefined || req.query.limit == "null"? 10 : req.query.limit;
    pool.getConnection(function(err, con){
        if (err){
            jsonResult.error = err;
            res.json(jsonResult);
        } else {
            var sql = `select p.id, p.name AS position_name, p.description, p.location, p.application, p.posted_time, p.deadline, t.type_name, c.name As company_name, c.image_url from
              (select * from ${table.position}
                ORDER BY RAND()
                LIMIT ${limit}) AS p
            LEFT JOIN ${table.company} AS c ON p.company_id = c.id
            LEFT JOIN ${table.position_type} AS t ON p.position_type = t.id`;
            // Execute query
            con.query(sql, function (err, result2) {
                if (err)
                    jsonResult.error = err;
                else
                    jsonResult.result = result2;
                res.json(jsonResult);
                con.release();
            });
        }
    });


}
