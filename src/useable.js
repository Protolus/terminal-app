const {
    subvalue
} = require('./util.js');
module.exports = (CLApp)=>{
    CLApp.prototype.useable = function(str, callback){
        var verb = typeof str === 'function'?'use':str;
        var cb = typeof str === 'function'?str:callback;
        var ob = this;
        this.config(function(err, config, save){
            ob[verb] = function(changes, cb){
                Object.keys(changes).forEach(function(key){
                    subvalue(config, key, changes[key]);
                });
                save(config, cb);
            };
            cb(err, config, save);
        }, true);
        this.command({
            name : verb,
            description: 'set the local configuration of a value',
            examples: [],
            action : function(argv, key){
                var value = argv._.shift();
                var changes = {};
                changes[key] = value;
                ob[verb](changes, function(){ });
            }
        });
    }
}
