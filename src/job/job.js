  
var API = require("../api");
var engine = require("../database/MySql"); 
var async = require('async');
var table = require('../table');

module.exports.init = function (app) {
    app.route(API.JOB_LISTING)
        .get(getJob);
    app.route(API.JOB_APPLY)
        .get(isApplied)
        .post(applyJob);
    app.route(API.SUBMISSION_LISTING).get(getSubmission);
    app.route(API.SUBMISSION_DELETE).post(deleteSubmission);
    app.route(API.SUBMISSION_PROGRESS_UPDATE).post(updateSubmissionProgress);
    app.route(API.COMPANY).get(getCompany)
    app.route(API.COMPANY_UPDATE).post(updateCompany);
    app.route(API.COMPANY_ADD).post(addCompany);
    app.route(API.COMPANY_DELETE).post(deleteCompany);
    app.route(API.POSITION_SUBMIT).post(addPositionAndSubmission);
    app.route(API.POSITION_TYPE).get(getPositionType);

};

function isApplied(req, res){
    let pool = engine.getPool();
    let user_id = req.query.user_id;
    let position_id = req.query.position_id;
    var jsonResult = {};
    pool.query(`select count(1) as c from ${table.submission} where user_id = ${user_id} and position_id=${position_id}`, (err, result) => {
        if (err){
            res.json({error: err});
        } else {
            if (result[0].c == 0){
                res.json({result: false});
            } else {
                res.json({result: true});
            }
        }
    })
}

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

function addPositionAndSubmission(req, res){
    let pool = engine.getPool();
    const body = req.body;
    const name = body.name;
    const description = body.description;
    const company_id = body.company_id;
    const position_type = body.position_type;
    const posted_time = body.posted_time;
    const deadline = body.deadline;
    const location = body.location;
    const user_created = body.user_created;
    let jsonResult = {};
    pool.getConnection(function(err, con){
        if (err){
            res.json({error: err});
        } else {
            const insertPositionQuery = `insert into ${table.position}(name, description, company_id, application, position_type, posted_time,deadline, location, user_created) value 
            ('${name}', '${description}', ${company_id}, 1, ${position_type}, '${posted_time}', '${deadline}', '${location}' ,${user_created})`;
            const insertSubmissionQuery = `insert into ${table.submission}(user_id, position_id) value(${user_created}, LAST_INSERT_ID())`;
            const insertProgressQuery = `insert into ${table.application_progress}(submission_id, progress_description, create_time, progress_type) 
            value(LAST_INSERT_ID(), "No description", NOW(), 1)`;
            async.waterfall([
                // insert position
                function(callback){
                    con.query(insertPositionQuery, function(err){
                        callback(err);
                    })
                },
                // insert submission
                function(callback){
                    con.query(insertSubmissionQuery, function(err){
                        callback(err);
                    })
                },
                // insert progress
                function(callback){
                    con.query(insertProgressQuery, function(err){
                        callback(err);
                    })
                },   
            ], function(err){
                if (err){
                    jsonResult.error = err;
                } else {
                    jsonResult.result = "OK";
                }
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
    let keyword = !req.query.keyword ||  req.query.keyword == "null" ? null : req.query.keyword;
    pool.getConnection(function(err, con){
        if (err){
            jsonResult.error = err;
            res.json(jsonResult);
        } else {
            var sql = `select p.id, p.name AS position_name, p.description, p.location, p.application, p.posted_time, p.deadline, t.type_name, c.name As company_name, c.image_url from
              (select * from ${table.position} as pos
                ${keyword ? `WHERE pos.name LIKE '%${keyword}%'`: ''}
                ORDER BY RAND()
                LIMIT ${limit}) AS p
            LEFT JOIN ${table.company} AS c ON p.company_id = c.id
            LEFT JOIN ${table.position_type} AS t ON p.position_type = t.id
            where p.user_created = 0 and c.user_created = 0`;
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

function getPositionType(req, res){
    let pool = engine.getPool();
    let jsonResult = {};
    pool.query(`select * from ${table.position_type}`, (err , result) => {
        if (err){
            jsonResult.error = err;
        } else {
            jsonResult.result = result;
        }
        res.json(jsonResult);
    })
}

function getCompany(req, res){
    let pool = engine.getPool();
    let user_id = req.query.user_id;
    let jsonResult = {};
    pool.query(`select * from ${table.company} where user_created = 0 or user_created = ${user_id}`, (err , result) => {
        if (err){
            jsonResult.error = err;
        } else {
            jsonResult.result = result;
        }
        res.json(jsonResult);
    })
}

function updateCompany(req, res){
    let pool = engine.getPool();
    const name = req.body.name;
    const image_url = req.body.image_url;
    const description = req.body.description;
    const id = req.body.id;
    let jsonResult = {};
    let sqlQuery = `update ${table.company} set name = '${name}', image_url = '${image_url}', description = '${description}' where id = ${id}`
    pool.query(sqlQuery, (err) => {
        if (err){
            jsonResult.error = err;
        } else {
            jsonResult.result = "OK";
        }
        res.json(jsonResult);
    });
}

function addCompany(req, res){
    let pool = engine.getPool();
    const user_id = req.query.user_id;
    const name = req.body.name;
    const image_url = req.body.image_url;
    const description = req.body.description;
    const id = req.body.id;
    let jsonResult = {};
    let sqlQuery = `insert into ${table.company}(name, description, image_url, user_created) value 
    ('${name}', '${description}', '${image_url}', ${user_id})`;
    pool.query(sqlQuery, (err ) => {
        if (err){
            jsonResult.error = err;
        } else {
            jsonResult.result = "OK";
        }
        res.json(jsonResult);
    });
    
}

function deleteCompany(req, res){
    let pool = engine.getPool();
    const id = req.query.company_id;
    const user_id = req.query.user_id;
    let jsonResult = {};
    let sqlQuery = `delete from ${table.company} where id = ${id} and user_created = ${user_id}`;
    pool.query(sqlQuery, (err) => {
        if (err){
            jsonResult.error = err;
        } else {
            jsonResult.result = "OK";
        }
        res.json(jsonResult);
    });
}