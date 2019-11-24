

const config =  {
    user: 'root',
    password: 'Getover2401',
    host: '35.188.176.208', 
    connectionLimit : 50,
    dateStrings: true,
};

const initConfig = {
    ...config
}

class MySQL {
    constructor() {
        this.database = require("mysql");
        this.config = {
            ...initConfig
        }
        this.pool = this.database.createPool(this.config);
    }

    reset(){
        this.config = {...initConfig};
        this.pool = this.database.createPool(this.config);
        return this.pool;
    }

    connect(username, password){
        this.config.user = username;
        this.config.password = password;
        this.pool = this.database.createPool(this.config);
        return this.pool;
    }


    getPool(){
        return this.pool;
    }
}

const engine = new MySQL();

module.exports = engine;

