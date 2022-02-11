const fs = require('fs');
const os = require('os');
const path = require('path');
const exec = require('child_process').exec;
const makeTempFile = (body, cb)=>{
    let name = path.join(os.tmpdir(), Math.floor(Math.random()*1000000)+'.temp');
    fs.writeFile(name, body, (err)=>{
        cb(err, (!err) && name, (callback)=>{
            fs.unlink(name, callback);
        });
    });
};
const tool = {
    clExecute : (command, cb)=>{
        let child = exec(command,
          function (err, stdout, stderr){
              let error = err || (stderr && new Error(stderr));
              if(error) console.log('exec error: ' + error);
              cb(error?error:null, stdout);
        });
    },
    executeActionUsingFileFromBody : (bin, action, definition, callback)=>{
        makeTempFile(definition, (err, filename, deleteFile)=>{
            if(err) return callback(err);
            let command = bin+' '+action+' '+filename;
            tool.clExecute(command, (exerr, output)=>{
                if(exerr) return callback(exerr);
                deleteFile((delErr)=>{
                    if(delErr) return callback(delErr);
                    try{
                        return callback(null, JSON.parse(output));
                    }catch(parseErr){
                        return callback(parseErr);
                    }
                })
            });
        });
    },
    hasArgument : (arg, str)=>{
        if(!str) return false;
        return !!(str.match(new RegExp('\-\-'+arg)));
    },
    localData : (appName, filePath, cb)=>{
        fs.stat(path.join(os.homedir(), '.'+appName), (err, stats)=>{
            if(err) return cb(new Error('No local directory'))
            fs.readFile(
                path.join(os.homedir(), '.'+appName, filePath),
                cb
            )
        });
    },
    testHelp : (bin, opts, callback)=>{
        tool.clExecute(bin+' --help', (exerr, output)=>{
            if(exerr) return callback(exerr);
            callback(null, output);
        });
    }
}

module.exports = tool;
