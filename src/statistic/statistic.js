  
var API = require("../api");
var engine = require("../database/MySql"); 
var async = require('async');
var table = require('../table');

module.exports.init = function (app) {
    app.route(API.STATISTIC)
        .get(getStatistic);
};

function getStatistic(req, res){
    let pool = engine.getPool();
    let user_id = req.query.user_id;
    var jsonResult = {};
    pool.getConnection(function(err,con){
        if (err){
            jsonResult.error = err;
            res.json(jsonResult);
        } else {
            var resJson = {};
            const statProgress = function (user_id) {
                return `select res.*, t.name from (select stat.last_progress_type,  count(stat.last_progress_type) as count
                        from (select p.submission_id, max(p.progress_type) as last_progress_type
                        from ${table.submission} as s
                        inner join ${table.application_progress} as p on s.id = p.submission_id
                        where user_id = ${user_id}
                        group by p.submission_id) as stat
                        group by stat.last_progress_type) as res
                        left join ${table.progress_type} as t on res.last_progress_type = t.id`
            }

            const statTotal = function(user_id){
                return `select count(*) as total_submission from ${table.submission} where user_id = ${user_id} group by user_id`
            }

            const submissionIn30Days = function(user_id){
                return `select p.create_time, count(*) as submissions
                        from ${table.submission} as s inner join ${table.application_progress} as p 
                        on s.user_id = ${user_id} and s.id = p.submission_id and p.progress_type = 1
                        where p.create_time between date_sub(now(), interval 30 day) and now()
                        group by p.create_time;`
            }

            async.parallel([
                // Get progress
                function(callback){
                    con.query(statProgress(user_id), (err, result) => {
                        if (err) callback(err);
                        else {
                            resJson.progress_statistic = result;
                            callback(null);
                        }
                    })
                },
                // Get total
                function(callback){
                    con.query(statTotal(user_id), (err, result) => {
                        if (err) callback(err);
                        else {
                            resJson.total_submission = result.length > 0 ? result[0].total_submission : 0;
                            callback(null);
                        }
                    })
                },
                // Submissions in 30 days
                function(callback){
                    con.query(submissionIn30Days(user_id), (err, result) => {
                        if (err) callback(err);
                        else {
                            resJson.submissions_in_30_days = result;
                            callback(null);
                        }
                    })
                }
            ], function(err){
                if (err){
                    jsonResult.error = err;
                } else {
                    jsonResult.result = resJson;
                }
                res.json(jsonResult);
                con.release();
            })
        }
    })
}