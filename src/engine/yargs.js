const yargs = require('yargs');

let argv;
const cliUtility = {
    command : (instance)=>{

    },
    argument : (instance)=>{

    },
    header : (instance, text)=>{
        header = text;
        yargs.usage(text);
    },
    footer : (instance, text)=>{
        yargs.epilog(text);
    },
    help : (instance, chr)=>{
        yargs.help(chr).alias(chr, 'help');
    },
    args : (instance)=>{
        return argv || (argv = yargs.argv);
    },
    process : (instance, cb)=>{
        try{
            var args = cliUtility.args(this);
            var action = args._.shift();
            var target = args._.shift();
            cb(null, action, target, args);
            return args;
        }catch(ex){
            cb(ex);
        }
    }
};

module.exports = cliUtility;
