/**
 * 1. Promise存在三个状态（state）pending、fulfilled、rejected,
 *    pending（等待态）为初始态，并可以转化为fulfilled（成功态）和rejected（失败态),
 *    resolve接收并保存成功时的值（value）, 并修改状态为fulfilled,
 *    reject接收并保存失败时的值（value）, 并修改状态为rejected,
 *    new Promise((resolve, reject)=>{resolve(value)}) resolve为成功，接收参数value，状态改变为fulfilled，不可再次改变。
 *    new Promise((resolve, reject)=>{reject(reason)}) reject为失败，接收参数reason，状态改变为rejected，不可再次改变。
 * 2. 拥有.then 方法
 *    允许多次链式调用，所以返回值是promise2
 *    接收onFulfilled和onRejected方法，分别在resolve和reject后执行，因此需要有onFulfilled和onRejected的队列存储
 *    要确保 onFulfilled 和 onRejected 方法异步执行，且应该在 then 方法被调用的那一轮事件循环之后的新执行栈中执行。我们用setTimeOut实现
 * 
 * 3. resolvePromise
 *      1.如果 promise 和 x 指向同一对象，以 TypeError 为据因拒绝执行 promise。
 *      x 不能是null
        x 是普通值 直接resolve(x)
        x 是对象或者函数（包括promise），let then = x.then
        2、当x是对象或者函数（默认promise）
        声明了then
        如果取then报错，则走reject()
        如果then是个函数，则用call执行then，第一个参数是this，后面是成功的回调和失败的回调
        如果成功的回调还是pormise，就递归继续解析
        3、成功和失败只能调用一个 所以设定一个called来防止多次调用
*/

const PENDING = 'pending';
const FULFILLED = 'fulfilled';
const REJECTED = 'rejected';
 
class MyPromise {
    constructor(fn){
        this.state = PENDING;
        this.reason = null;
        this.value = null;
        this.fulfilledCallbacks = [];
        this.rejectedCallbacks = [];
        const resolve = (value) => {
            if(this.state === PENDING) {
                this.value = value;
                // console.log('......PENDING', value)
                this.fulfilledCallbacks.forEach(fn => fn(value));
                this.state = FULFILLED;
                // console.log(this)
            }
        }
        const reject = (reason) => {
            if(this.state === PENDING) {
                this.reason = reason;
                this.rejectedCallbacks.forEach(fn => fn(reason));
                this.state = REJECTED;
            }
        }
        try {
            fn(resolve, reject);
        } catch (error) {
            reject(error)
        }
    }
    // 2.---
    then(onFulfilled, onRejected) {
        // 如果 onFulfilled 不是函数且 promise1 成功执行， promise2 必须成功执行并返回相同的值。
        // 如果 onRejected 不是函数且 promise1 拒绝执行， promise2 必须拒绝执行并返回相同的据因。
        onFulfilled = typeof onFulfilled === 'function' ? onFulfilled : (value) => value;
        onRejected = typeof onRejected === 'function' ? onRejected : (err) => {throw err};

        // 3.----
        const resolvePromise = (promise, x, resolve, reject) => {
            let called = false;
            if(promise === x) {
                reject(new TypeError('请避免循环引用Promise'));
                return;
            } else if(x !== null && typeof x === 'object' || typeof x === 'function'){
                try {
                    let then = x.then;
                    if(typeof then === 'function') {
                        then.call(x, y => {
                            if(called) return;
                            called = true;
                            resolvePromise(promise, y, resolve, reject);
                        }, err => {
                            if(called) return;
                            called = true;
                            reject(err)
                        })
                    }else{
                        resolve(x)
                    }
                } catch (error) {
                    if(called) return;
                    called = true;
                    reject(error)
                }
            } else {
                resolve(x)
            }
        }
        
        // 链式调用，要求返回一个promise
        let promise2 = new MyPromise((resolve, reject) => {
            if(this.state === PENDING) {
                this.fulfilledCallbacks.push(value => {
                    setTimeout(() => {
                        try {
                            let x = onFulfilled(value)
                            resolvePromise(promise2, x, resolve, reject)
                        } catch (error) {
                            reject(error)
                        }
                    })
                });
                this.rejectedCallbacks.push(reason => {
                    setTimeout(() => {
                        try {
                            let x = onRejected(reason);
                            resolvePromise(promise2, x, resolve, reject)
                        } catch (error) {
                            reject(error)
                        }
                    });
                });
            }
            // 当在其他程序中多次调用同一个promise的then时 由于之前状态已经为FULFILLED / REJECTED状态，则会走以下逻辑,
            // 所以要确保为FULFILLED / REJECTED状态后 也要异步执行onFulfilled / onRejected ,这里使用setTimeout
            if(this.state === FULFILLED) {
                setTimeout(() => {
                    try {
                        let x = onFulfilled(this.value);
                        resolvePromise(promise2, x, resolve, reject)
                    } catch (error) {
                        reject(error)
                    }
                })
            }
            if(this.state === REJECTED) {
                setTimeout(() => {
                    try {
                        let x = onRejected(this.reason);
                        resolvePromise(promise2, x, resolve, reject)
                    } catch (error) {
                        reject(error)
                    }
                })
            }
        })
        return promise2;
    }
    catch(onRejected) {
        return this.then(null, onRejected)
    }
    finally(callback){
        return this.then(value => {
            return MyPromise.resolve(callback()).then(() => value)
        }, reason => {
            return MyPromise.reject(callback()).then(() => {throw reason})
        })
    }
    
}
MyPromise.resolve = function (value) {
    return new MyPromise(resolve => resolve(value))
}
MyPromise.reject = function (value) {
    return new MyPromise((resolve, reject) => reject(value))
}
MyPromise.race = function (promises) {
    return new MyPromise((resolve, reject) => {
        for (let i = 0; i < promises.length; i++) {
            const promise = promises[i];
            promise.then(resolve, reject)
        }
    })
}
MyPromise.all = function (promises) {
    return new MyPromise((resolve, reject) => {
        let arr = [];
        for (let i = 0; i < promises.length; i++) {
            const promise = promises[i];
            promise.then((value) => {
                arr.push(value);
                if (arr.length === promises.length) {
                    resolve(arr)
                }
            }, reject);
        }
    })
}


MyPromise.deferred = function() {
    let defer = {};
    defer.promise = new MyPromise((resolve, reject) => {
      defer.resolve = resolve;
      defer.reject = reject;
    });
    return defer;
};

// new MyPromise((resolve, reject) => {
//     setTimeout(() => {
//         Math.random() > 0.5 ? resolve(1) : reject(2)
//     }, 1000)
// }).then(val => console.log(val)).catch(err => console.log(err))


// const promise = MyPromise.race([
//     new MyPromise((resolve, reject) => {
//         setTimeout(() => {
//             resolve(1)
//         }, 1000)
//     }),
//     new MyPromise((resolve, reject) => {
//         setTimeout(() => {
//             resolve(2)
//         }, 2000)
//     }),
// ]).then(res => res)


const promises = MyPromise.all([
    new MyPromise((resolve, reject) => {
        setTimeout(() => {
            resolve(1)
        }, 1000)
    }),
    new MyPromise((resolve, reject) => {
        setTimeout(() => {
            resolve(2)
        }, 2000)
    }),
]).then(res => res)

setTimeout(() => {
    console.log('promise.....', promises)
}, 3000)


module.exports = MyPromise;
