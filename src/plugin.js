var CLAppPlugin = function(name, opts){
    this.name = name;
    this.data = opts || {};
}

CLAppPlugin.prototype.configureCLApp = function(app){
    app.argument({
        name : this.name,
        type : 'boolean',
        description: 'use the '+this.name+' personality'
    });
};

CLAppPlugin.prototype.isEnabled = function(argv){
    return !!argv[this.name];
};

module.exports = CLAppPlugin;
