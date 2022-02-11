const log = require('simple-log-function');

module.exports = (CLApp)=>{
    CLApp.prototype.log = function(message, level, context){
        log(message, level, context);
    }

    CLApp.prototype.log.levels = log.levels;
}
