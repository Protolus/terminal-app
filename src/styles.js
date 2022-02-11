module.exports = (type)=>{
    switch((type||'').toLowerCase()){
        case 'default': return {
            actionColor : 'blue',
            stringColor : 'yellow',
            flagColor : 'cyan',
            sigColor : 'magenta'
        };
        default: return {
            actionColor : 'blue',
            stringColor : 'yellow',
            flagColor : 'cyan',
            sigColor : 'magenta'
        };
    }
}
