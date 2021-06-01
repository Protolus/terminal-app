var yargs = require('yargs');
var fs = require('fs');
var os = require('os');
var path = require('path');
var rc = require('rc');
var art = require('ascii-art');
//var npm = require('npm');
var mkdirp = require('mkdirp');
var CJSON = require('comment-json');

var styles = {
    actionColor : 'blue',
    stringColor : 'yellow',
    flagColor : 'cyan',
    sigColor : 'magenta'
}

var CLApp = function(appName, opts){
    this.options = opts || {};
    this.name = appName;
    if(!this.options.defaults) this.options.defaults = '//file created by '+"\n"+'{}';
    if(!this.options.config) this.options.config = {};
    this.commands = {};
}

CLApp.prototype.header = function(headerText){
    var header = '';
    if(headerText){
        header = headerText;
    }else{
        if(this.hasPluginsEnabled){
            header += 'Plugins:'+"\n"+'    '+(sourceList.length?sourceList.join(', '):'N/A')+"\n\n";
        }
    }
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
    var chr = getCharFor('help')
    yargs.help(chr).alias(chr, 'help');
}

CLApp.prototype.run = function(){
    argv = yargs.argv;
    var action = argv._.shift();
    var target = argv._.shift();
    if(!this.commands[action]) throw new Error('unrecognized action!');
    this.commands[action](argv, target);
}

CLApp.prototype.footer = function(footerText){
    //todo make sure command has been called
    var text = footerText;
    if((!text) && this.options.copyright && this.options.copystart){
        var year = (new Date()).getFullYear()+'';
        var range = (this.options.copystart === year)?year:this.options.copystart+' - '+year;
        yargs.epilog('[ © '+range+' : '+this.options.copyright+' ]');
    }else{
        yargs.epilog(footerText);
    }
    yargs.usage(this.headerText+"\n"+this.usage());
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
    var chr = forceChar || getCharFor(options.name);
    if(!yargs[options.type]) throw new Error('Unsupported type: '+options.type);
    if(options.type !== 'string'){
        yargs[options.type](chr);
    }
    yargs.alias(chr, options.name);
    yargs.nargs(chr, options.num || (options.type === 'boolean'?0:1))
    var post = '';
    if(choices){
        //yargs.choices(chr, choices).skipValidation(chr);
        var chunked = chunkLines(choices.map(function(name){
            return art.style(
                ' '+name+' ',
                'white_bg+black+encircled',
                true
            );
        }), ', ', 44, 55, true, {
            preindent: art.style('Choices: ', 'yellow+bold', true)
        });
        post = "\n\n"+chunked+"\n";
        //console.log('|'+chunked+'|')
        /*
        post = "\n"+'[ '+choices.map(function(name){
            return art.style(name, 'grey_bg+white+bold', true);
        }).join(', ')+' ]';
        //*/
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
    var coloredName = art.style(options.name, styles.actionColor, true);
    var rgx = new RegExp(' '+options.name+' ', 'g');
    var styleThings = function(str){
        return str
            .replace( rgx, ' '+coloredName+' ' )
            .replace( /(".*?")/g, function(i, match){
                return art.style(match, styles.stringColor, true);
            }).replace( /(-.(?: |$))/g, function(i, match){
                return art.style(match, styles.flagColor, true);
            })
    };
    yargs.command(coloredName, options.description);
    options.examples.forEach(function(example){
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

CLApp.prototype.config = function(cb){
    if(this.hasConfigDirEnabled){
        return this.computedConfig || (
            this.computedConfig = rc(this.name, this.options.config)
        );
    }else{
        return this.options.config;
    }
    this.hasConfigDirEnabled = true;
}

CLApp.prototype.defaultPluginDir = function(cb){
    return path.join(os.homedir(), '.'+this.name, 'node_modules');
}

CLApp.prototype.plugins = function(types, cb){
    this.hasPluginsEnabled = true;
    this.command({
        name : 'install',
        description: 'install a particular plugin, by type',
        examples: [],
        action : function(argv, target){
            // format is: max install <type> <target>
            // where type = personality/plugin/engine
            console.log('INST', arguments);
        }
    });
    this.modulePath = this.defaultPluginDir();
    var typeNames = Object.keys(types);
    var ob = this;
    var done = function(){
        cb(null, ob.config(), function(type){ //loadPluginsByType or 1type

        })
    }
    if(!this.hasConfigDirEnabled) this.configDir(done);
    else done();
}

var ensureDir = function(path, cb){
    fs.stat(path, function(err, stat){
        if(err){
            mkdirp(path).then(function(made){
                console.log(`made directories, starting with ${made}`)
                cb();
            }).catch(function(err2){
                cb(err2);
            })
        }else{
            cb();
        }
    })
}

var ensureConfig = function(path, cb){
    ensureDir(path, function(err){
        if(err) return cb(err);

    })
}

var installInDir = function(modules, dir, cb){
    npm.load(function(err) {
      // handle errors

      // install module ffi
      npm.commands.install(modules, function(er, data) {
        // log errors or data
      });

      npm.on('log', function(message) {
        // log installation progress
        console.log(message);
      });
    });
}


var fwd = {};
var rvs = {};

var getCharFor = function(cmd, preferCaps){
    var chars = cmd.split('');
    var chr;
    for(var lcv=0; lcv < chars.length; lcv++){
        chr = chars[lcv];
        if(preferCaps){
            chr = chr.toUpperCase();
            if(!fwd[chr]){
                fwd[chr] = cmd;
                rvs[cmd] = chr;
                return chr;
            }
        }
        chr = chr.toLowerCase();
        if(!fwd[chr]){
            fwd[chr] = cmd;
            rvs[cmd] = chr;
            return chr;
        }
        if(!preferCaps){
            chr = chr.toUpperCase();
            if(!fwd[chr]){
                fwd[chr] = cmd;
                rvs[cmd] = chr;
                return chr;
            }
        }
    }
}

var padStart = function(s, diff, p){
    var pad = p || ' ';
    //var diff = n - Ansi.length(s);
    var padding = '';
    for(var lcv=0; lcv < diff; lcv++){
        padding += pad;
    }
    //console.log(s, n, diff, '|'+padding+'|')
    return padding+s;
}

var chunkLines = function(chunks, delimiter, length, flushTo, process, opts){
    var options = opts || {};
    var lines = [];
    var line = '';
    chunks.forEach(function(chunk){
        var lineLen = Ansi.length(line);
        var chunkLen = Ansi.length(chunk);
        if( (lineLen + chunkLen + delimiter.length) > length){
            lines.push(line);
            line = '';
        }
        line += (chunk + delimiter);
    });
    line = line.substring(0, line.length - (delimiter.length-1))
    lines.push(line);
    if(flushTo){
        lines.forEach(function(line, index){
            var lineLen = Ansi.length(lines[index]);
            var diff = flushTo - lineLen;
            if(process === true){
                diff = flushTo - length;
            }
            if(diff > 0){
                lines[index] = padStart(lines[index], diff, "⠀");
                if(options.preindent && index === 0){
                    var preindentOffset = diff - Ansi.length(options.preindent)-1;
                    lines[0] = Ansi.substring(lines[0], 0, preindentOffset)+
                        options.preindent+
                        Ansi.substring(lines[0], diff)

                }
            }
        });
    }
    return (process && process !== true)?process(lines).join("\n"):lines.join("\n");
}
module.exports = CLApp;
