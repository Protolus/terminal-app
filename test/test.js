const should = require('chai').should();

const CLApp = require('../app');
const path = require('path');
const os = require('os');
const fs = require('fs');
const test = require('../src/test-util');
const {
    readCommentJSONSync
} = require('../src/util.js');

const bin = {
    echo: path.join( __dirname, 'bin', 'echo-app' ),
    echoUse: path.join( __dirname, 'bin', 'echo-use-app' )
};

const name = {
    echo : 'test-app-echo',
    echoUse : 'test-app-use-echo',
};

const dir = {
    echo : path.join(os.homedir(), '.'+name.echo),
    echoUse : path.join(os.homedir(), '.'+name.echoUse),
};

describe('app-term-kit', ()=>{
    describe('with no plugins', ()=>{
        describe('test app echo-app', ()=>{
            it('has working help', (done)=>{
                test.testHelp(bin.echo, {}, (err, result)=>{
                    test.hasArgument('help', result).should.be.equal(true);
                    test.hasArgument('version', result).should.be.equal(true);
                    done();
                });
            });

            it('executes `echo` action', (done)=>{
                test.clExecute(bin.echo+' echo "something"', (err, output)=>{
                    should.not.exist(err);
                    output.trim().should.equal("something");
                    done()
                });
            });

            it('default configuration does not create a data file', (done)=>{
                test.localData('test-app-echo', 'config.json', (err, result)=>{
                    should.exist(err);
                    err.message.should.equal('No local directory');
                    done();
                })
            });
        });

        describe('test app echo-use-app', ()=>{
            it('has working help', (done)=>{
                test.testHelp(bin.echoUse, {}, (err, result)=>{
                    test.hasArgument('help', result).should.be.equal(true);
                    test.hasArgument('version', result).should.be.equal(true);
                    done();
                });
            });

            it('executes `echo` action', (done)=>{
                test.clExecute(bin.echoUse+' echo "something"', (err, output)=>{
                    should.not.exist(err);
                    output.trim().should.equal("something");
                    done()
                });
            });

            it('config changes are saved', (done)=>{
                test.clExecute(bin.echoUse+' set foo bar', (exerr, output)=>{
                    fs.stat(dir.echoUse, (staterr, stats)=>{
                        should.not.exist(staterr);
                        try{
                            let data = readCommentJSONSync(path.join(dir.echoUse, 'config'));
                            data.foo.should.equal('bar');
                        }catch(ex){ should.not.exist(ex) }
                        done();
                    });
                });
            });

            after((done)=>{
                fs.rm(dir.echoUse, { recursive: true, force: true }, (err)=>{
                    should.not.exist(err);
                    done();
                })
            })
        });
    });

    describe('with plugins', ()=>{

    });
})
