const PORT = 3000;
const HOST = "http://localhost:"+PORT;

const JOB_LISTING = "/job/list";
const REGISTER = "/register";
const LOGIN = "/login";
const JOB_APPLY = "/job/apply";
const SUBMISSION_LISTING = "/submission/list";
const SUBMISSION_DELETE = "/submission/delete";
const SUBMISSION_PROGRESS_UPDATE = "/submission/progress/update";
const STATISTIC = "/statistic";
module.exports = {
    HOST,
    JOB_LISTING,
    REGISTER,
    LOGIN,
    JOB_APPLY,
    SUBMISSION_LISTING,
    SUBMISSION_DELETE,
    SUBMISSION_PROGRESS_UPDATE,
    STATISTIC,
}