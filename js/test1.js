var testObj = (function() {
    var data = {__proto__:null}; // 100% private 

    return new Class({
        get: function(key) {
            return data[key] || null;
        },
        set: function(key, value) {
            data[key] = value;
        },
        remove: function(key) {
            delete data[key];
        },
        otherMethod: function() {
            alert(this.get("foo"));
        }
    });
});


var foo = new new testObj();
var bar = new new testObj();

foo.set("bar", "banana");
console.log(foo.get("bar")); // banana!
console.log(bar.get("bar")); // undefined.
bar.set("bar", "apple");
console.info(foo.get("bar"), bar.get("bar")); // banana apple

