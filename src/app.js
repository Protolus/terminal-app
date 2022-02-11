const CJSON = require('comment-json');
const rc = require('rc');
var Emitter = require('extended-emitter');
var yargs = require('yargs');
var fs = require('fs');
var os = require('os');
var path = require('path');
const styles = require('./styles');
const {
    ensureDir,
    ensureConfig,
    installInDir,
    getCharFor,
    padStart,
    chunkLines,
    getShallowestPackageDir,
    requireWithFailToDir,
    ensureSymlinkExistsIfConfigDirDoes,
    readCommentJSONSync,
    writeCommentJSONSync,
    writeCommentJSON,
    styleStr,
    subvalue
} = require('./util.js');

var CLApp = function(appName, opts){
    this.engine = require('./engine/yargs');
    this.styles = (typeof opts.style === 'string')?styles(opts.style):opts.style;
    this.options = opts || {};
    this.name = appName;
    if(!this.options.defaults) this.options.defaults = '//file created by '+"\n"+'{}';
    if(!this.options.config) this.options.config = {};
    this.commands = {};
    (new Emitter()).onto(this);
}

CLApp.prototype.log = function(message, level, context){
    if(level) console.log(message, context); //only outputs errors
}
CLApp.prototype.log.levels = {'ERROR':true};

let sourceList = []; //TODO: fixme

CLApp.prototype.header = function(headerText){
    var header = '';
    if(headerText){
        header = headerText;
    }else{
        if(this.hasPluginsEnabled){
            //todo: handle output of failed loads/etc.
            header += 'Plugins:'+"\n"+'    '+(sourceList.length?sourceList.join(', '):'N/A')+"\n\n";
        }
    }
    this.engine.header(this, header);
    this.headerText = header;
}

var usage = 'Usage: $0 <command> [options] <target>';
CLApp.prototype.usage = function(value){
    if(value){
        usage = value;
    }
    return usage;
}

CLApp.prototype.help = function(){
    return this.engine.help(this, getCharFor('help'));
}

var argv;

CLApp.prototype.argv = function(){
    return this.engine.args(this);
}

CLApp.prototype.run = function(cb){
    try{
        this.engine.process(this, (err, action, target, args)=>{
            if(err) throw err;
            if(!this.commands[action]){
                var err = new Error('unrecognized action: '+ action);
                if(!cb) throw err;
                else cb(err);
            }else{
                try{
                    this.commands[action](args, target, function(){
                        if(cb) cb();
                    });
                }catch(ex){
                    cb(ex);
                }
            }
        });
    }catch(ex){
        cb(ex);
    }
}

CLApp.prototype.footer = function(footerText){
    //todo make sure command has been called
    var text = footerText;
    if((!text) && this.options.copyright && this.options.copystart){
        var year = (new Date()).getFullYear()+'';
        var tmGlyph = (this.options.trademark && '™') || (this.options.registeredTrademark && '®') || '';
        var tm = this.options.trademark || this.options.registeredTrademark;
        var tmName = this.name+' '+tmGlyph;
        var range = (this.options.copystart === year)?year:this.options.copystart+' - '+year;
        this.engine.footer(this, '[ '+
            ((this.options.copyright === tm && (tmName+' : ')) || '')
        +'© '+range+' : '+this.options.copyright+(
            ((this.options.copyright !== tm && tm && (' and '+tmName+' '+tm)) || '')
        )+' ]');
    }else{
        this.engine.footer(this, footerText);
    }
    this.engine.header(this, this.headerText+"\n"+this.usage());
}

CLApp.prototype.argument = function(name, type, description, num, choices, forceChar){
    var options = typeof name === 'object'?name:{
        name:name,
        type:type,
        description:description,
        num:num,
        choices:choices,
        forceChar:forceChar
    }
    var chr = options.forceChar || getCharFor(options.name);
    if(options.forceChar){
        fwd[chr] = options.name;
        rvs[options.name] = chr;
    }
    if(!yargs[options.type]) throw new Error('Unsupported type: '+options.type);
    if(options.type !== 'string'){
        yargs[options.type](chr);
    }
    yargs.alias(chr, options.name);
    yargs.nargs(chr, options.num || (options.type === 'boolean'?0:1))
    var post = '';
    if(options.choices){
        //yargs.choices(chr, choices).skipValidation(chr);
        var chunked = chunkLines(options.choices.map(function(name){
            return styleStr(
                ' '+name+' ',
                'white_bg+black+encircled',
                true
            );
        }), ', ', 44, 55, true, {
            preindent: styleStr('Choices: ', 'yellow+bold', true)
        });
        post = "\n\n"+chunked+"\n";
    }
    yargs.describe(chr, options.description+(post?post:''))
};
CLApp.prototype.command = function(name, description, examples, action){
    var options = typeof name === 'object'?name:{
        name:name,
        description:description,
        action: action,
        examples:(examples || [])
    }
    this.commands[options.name] = options.action;
    var coloredName = styleStr(options.name, styles.actionColor, true);
    var rgx = new RegExp(' '+options.name+' ', 'g');
    var styleThings = function(str){
        return str
            .replace( rgx, ' '+coloredName+' ' )
            .replace( /(".*?")/g, function(i, match){
                return styleStr(match, styles.stringColor, true);
            }).replace( /(-.(?: |$))/g, function(i, match){
                return styleStr(match, styles.flagColor, true);
            })
    };
    yargs.command(coloredName, options.description);
    if(options.examples) options.examples.forEach(function(example){
        if(Array.isArray(example)){
            yargs.example(styleThings(example[0]), styleThings(example[1]));
        }else{
            yargs.example(styleThings(example));
        }
    })
};

CLApp.prototype.configDir = function(cb){
    this.hasConfigDirEnabled = true;
    cb();
}

CLApp.prototype.config = function(cb, autoInit){
    var file = path.join(this.rootDir(), 'config');
    this.rootDirectoryExists(autoInit, (err)=>{
        var result = null;
        if(err){
            console.log('##', err);
            if(err.message === 'Not Initialized'){
                result = this.computedConfig || (
                    (this.computedConfig = rc(this.name, {autogenerated:true}))// &&
                    //(this.computedConfig = rc(this.name, this.options.config))
                );
            }
        }else{
            var commentCompatible;
            try{
                //this.options.defaults = this.options.defaults
                    //.replace('//EOF', ',"autogenerated":true');
                commentCompatible = readCommentJSONSync(file, this.options.defaults);
            }catch(ex){
                this.log(ex, this.log.levels.ERROR);
                commentCompatible = {};
            }
            result = commentCompatible;
        }
        if(this.rawConfig) CJSON.assign(result, this.rawConfig);
        setTimeout(function(){
            if(cb) cb(null, result, function(config, callb){
                writeCommentJSON(file, config, function(){
                    if(callb) callb();
                });
            });
        },0);
    });
    /*if(this.hasConfigDirEnabled){
        var result = this.computedConfig || (
            (this.computedConfig = rc(this.name, {autogenerated:true}))// &&
            //(this.computedConfig = rc(this.name, this.options.config))
        );
        var commentCompatible;
        try{
            //this.options.defaults = this.options.defaults
                //.replace('//EOF', ',"autogenerated":true');
            commentCompatible = readCommentJSONSync(file, this.options.defaults);
        }catch(ex){
            this.log(ex, this.log.levels.ERROR);
            commentCompatible = {};
        }
        if(this.rawConfig) CJSON.assign(commentCompatible, this.rawConfig);
        var stk = (new Error()).stack;
        setTimeout(function(){
            if(cb) cb(null, commentCompatible, function(config, callb){
                writeCommentJSON(file, config, function(){
                    if(callb) callb();
                });
            });
        },0);
        return commentCompatible;
    }else{
        if(autoInit){
            var ob = this;
            return this.configDir(function(){
                try{
                    ob.config(cb);
                }catch(ex){
                    this.log(ex, this.log.levels.ERROR);
                }
            }) || this.options.config;
        }
        return this.options.config;
    }*/
}

CLApp.prototype.defaultPluginDir = function(cb){
    return path.join(this.rootDir(), 'node_modules');
}

CLApp.prototype.rootDirectoryExists = function(ensure, cb){
    fs.stat(this.rootDir(), (err, stats)=>{
        if(err && ensure){
            ensureDir(this.rootDir(), cb)
        }else{
            setTimeout(()=>{
                cb();
            });
        }
    });
}

CLApp.prototype.rootDir = function(cb){
    return path.join(os.homedir(), '.'+this.name);
}

module.exports = CLApp;
