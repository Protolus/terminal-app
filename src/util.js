var CJSON = require('comment-json');
var mkdirp = require('mkdirp');
var { Ansi, Color } = require('@ansi-art/tools');
var fs = require('fs');
var os = require('os');
var path = require('path');

const ansi = new Ansi(new Color('4bit'));

var ensureDir = function(path, cb){
    fs.stat(path, function(err, stat){
        if(err){
            mkdirp(path).then(function(made){
                this.log(
                    `made directories, starting with ${made}`,
                    this.log.levels.INFO
                );
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
        else cb();
    })
}

var installInDir = function(modules, dir, cb){
    var startDir = process.cwd();
    process.chdir(dir);
    var wrappedCb = function(err, res){
        process.chdir(startDir);
        cb(err, res);
    }
    var npm = require('npm');
    npm.load(function(err){
        if(err) return wrappedCb(err);
        npm.commands.install(modules, function(er, data) {
            if(er) return wrappedCb(er);
            wrappedCb(null, data);
        });

        npm.on('log', function(message) {
          // log installation progress
          this.log(
              `INSTALL: ${message}`,
              this.log.levels.INFO
          );
        });
    });
}


var fwd = {};
var rvs = {};

var getCharFor = function(cmd, preferCaps){
    var chars = cmd.split('');
    var chr;
    var inverse;
    for(var lcv=0; lcv < chars.length; lcv++){
        chr = chars[lcv];
        if(preferCaps){
            chr = chr.toUpperCase();
            inverse = chr.toLowerCase();
        }else{
            chr = chr.toLowerCase();
            inverse = chr.toUpperCase();
        }
        if(!fwd[chr]){
            fwd[chr] = cmd;
            rvs[cmd] = chr;
            return chr;
        }
        if(!fwd[inverse]){
            fwd[inverse] = cmd;
            rvs[cmd] = inverse;
            return inverse;
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
        var lineLen = ansi.length(line);
        var chunkLen = ansi.length(chunk);
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
            var lineLen = ansi.length(lines[index]);
            var diff = flushTo - lineLen;
            if(process === true){
                diff = flushTo - length;
            }
            if(diff > 0){
                lines[index] = padStart(lines[index], diff, "⠀");
                if(options.preindent && index === 0){
                    var preindentOffset = diff - ansi.length(options.preindent)-1;
                    lines[0] = ansi.substring(lines[0], 0, preindentOffset)+
                        options.preindent+
                        ansi.substring(lines[0], diff)

                }
            }
        });
    }
    return (process && process !== true)?process(lines).join("\n"):lines.join("\n");
}

var getShallowestPackageDir = function(p){
    try{
        fs.statSync(path.join(p, 'package.json'))
        return p;
    }catch(ex){
        return getShallowestPackageDir(path.dirname(p));
    }
}

var requireWithFailToDir = function(dir, rqr){
    return function(name){
        var res;
        try{
            res = rqr(name);
        }catch(ex){
            var pth = path.join(dir, name);
            try{
                //res = rqr(pth);
                res = require(pth);
            }catch(ex2){
                this.log(
                    'FAILED ATTEMPTED SIDELOAD: '+pth,
                    this.log.levels.INFO
                );
                throw ex; //if we didn't pick it up, report the normal failure
            }
        }
        return res;
    };
}

var ensureSymlinkExistsIfConfigDirDoes = function(configDir, lf){
    var linkFile = lf;
    if(linkFile.indexOf(':root:') !== -1){
        //todo: make this cross platform
        var rootDir = path.dirname(require.main.filename);
        linkFile = path.join(linkFile.replace(':root:', rootDir));
    }
    if(linkFile.indexOf(':modules:') !== -1){
        var rootDir = getShallowestPackageDir(require.main.filename);
        var moduleDir = path.join(rootDir, 'node_modules');
        linkFile = path.join(linkFile.replace(':modules:', moduleDir));
    }
    var linkDir = path.dirname(linkFile);
    var configStats;
    var linkDirStats;
    var linkStats;
    try{
        configStats = fs.statSync(configDir);
        linkDirStats = fs.statSync(linkDir);
        linkStats = fs.statSync(linkFile);
    }catch(ex){}
    if(configStats && linkDirStats){
        if(!linkStats) fs.symlinkSync(configDir, linkFile);
        return linkFile;
    }else{}
}

var readCommentJSONSync = function(file, defaultConfig){
    var config;
    try{
        config = CJSON.parse(fs.readFileSync(file).toString());
    }catch(ex){
        config = CJSON.parse(defaultConfig);
        config.autogenerated = true;
    }
    return config;
}

var writeCommentJSONSync = function(file, config){
    return fs.writeFileSync(file, CJSON.stringify(config, null, 2));
}

var writeCommentJSON = function(file, config, cb){
    fs.writeFile(file, CJSON.stringify(config, null, 2), cb);
}

var styleStr = function(str, style){
    return ansi.codes(str, style, true);
}

var subvalue = (obj, path, val) => {
    var keys = path.split('.');
    var lastKey = keys.pop();
    var lastObj = keys.reduce((obj, key) =>
        obj[key] = obj[key] || {},
        obj);
    return lastObj[lastKey] = val;
};

//-------
module.exports = {
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
}
