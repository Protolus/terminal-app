const CLAppPlugin = require('./plugin');

module.exports = (CLApp)=>{
    var lastTypes;
    var lastPlugs;
    var lastFlatPlugs;

    CLApp.prototype.plugin = function(type, name){
        return lastPlugs[type] && lastPlugs[type].find(function(plug){
            return plug.name === name;
        }).data;
    }

    CLApp.prototype.plugins = function(types, cb){
        lastTypes = types;
        this.hasPluginsEnabled = true;
        var ob = this;
        Object.keys(types).forEach(function(typeName){
            if(types[typeName].prefix && !types[typeName].detect){
                var prefix = types[typeName].prefix;
                types[typeName].detect = function(s){
                    return s.indexOf(prefix) === 0
                };
            }
        });
        var getPlugins = function(arg1, cb){ //loadPluginsByType or 1type
            var callback = (typeof arg1 === 'function' && !cb)?arg1:cb;
            var type = (typeof arg1 === 'function' && !cb)?'*':arg1;
            if(typeNames.indexOf(type) === -1 && type !== '*'){
                return callback(new Error('type not recognized:'+type));
            }
            var pluginDir = path.dirname(ob.defaultPluginDir());
            fs.readdir(pluginDir, function(err, list){
                //loadPlugins
                if(err) return cb(err);
                if(arg1 === '*'){
                    var result = {};
                    var resultObs = {};
                    typeNames.forEach(function(typeName){
                        if(types[typeName] && types[typeName].detect){
                            result[typeName] = list.filter(function(item){
                                return types[typeName].detect(item);
                            });
                            var pth;

                            resultObs[typeName] = result[typeName].map(function(item){
                                var pth = path.join(ob.defaultPluginDir(), item, 'package.json');
                                var name = item.split('-').pop();
                                var pkg = require(pth);
                                if(pkg.main){
                                    var mainPath = path.join(ob.defaultPluginDir(), item, pkg.main);
                                    pkg = require(mainPath)
                                }
                                return new CLAppPlugin(name, pkg);
                            })
                        }
                    });
                    lastPlugs = resultObs;
                    cb(null, result, resultObs);
                }else{
                    var filtered = list.filter(function(item){
                        return typeNames.reduce(function(value, typeName){
                            return value || (
                                (type === '*' || type === typeName) &&
                                types[type] &&
                                types[type].detect(item)
                            );
                        }, false);
                    });
                    lastFlatPlugs = filtered.map(function(item){
                        var pth = path.join(ob.defaultPluginDir(), item, 'package.json');
                        var name = item.split('-').pop();
                        return new CLAppPlugin(name, require(pth));
                    })
                    cb(null, filtered, lastFlatPlugs);
                }
            })
        };
        this.command({
            name : 'install',
            description: 'install a particular plugin, by type',
            examples: [],
            action : function(argv, type){
                // format is: <bin> install <type> <name>
                var plugin = argv._.pop();
                if(!plugin) throw new Error('Plugins require a type and a name');
                ensureConfig(ob.rootDir(), function(err){
                ensureConfig(ob.defaultPluginDir(), function(err){
                    getPlugins('*', function(err, plugins){
                        if(err) return cb(err);
                        if(!plugins[type]){
                            throw new Error('Unknown plugin type: '+type);
                        }
                        var stripped = plugins[type].map(function(str){
                            return str.split('-').pop();
                        });
                        argv._.unshift(plugin);
                        var plugs = argv._;
                        //todo: verify
                        plugs.forEach(function(plug){
                            if(stripped.indexOf(plug) !== -1){
                                throw new Error('This plugin is already installed: '+plug);
                            }
                        });
                        var modules = plugs.map(function(plug){
                            return (types[type].prefix || '') + plug;
                        });
                        if(err) return cb(err);
                        installInDir(modules, ob.modulePath, function(err, data){
                            if(err) return cb(err);
                            ob.emit('plugins-installed', modules);
                            this.log(
                                'INSTALLED:'+type+' ('+modules.join(', ')+')',
                                this.log.levels.INFO
                            );
                        });
                    });
                });
                });
            }
        });
        this.modulePath = this.defaultPluginDir();
        var typeNames = Object.keys(types);
        var ob = this;
        var done = function(){
            var pluginDir = ob.defaultPluginDir();
            //var aaDir = path.dirname(pluginDir);
            //var linkTarget = ob.options.fslink || process.cwd();
            //var link = ensureSymlinkExistsIfConfigDirDoes(aaDir, linkTarget);
            //var t = process.cwd();
            var t = __dirname;
            var rp = path.relative(t, pluginDir);
            var rqr = requireWithFailToDir(rp, require.main.require)
            return cb(null, ob.config(), getPlugins, function(name){
                return rqr(name);
            });
        }
        if(!this.hasConfigDirEnabled) this.configDir(done);
        else done();
    }
}
