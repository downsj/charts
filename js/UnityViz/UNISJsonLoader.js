/**
 * Created with JetBrains WebStorm.
 * User: arzan
 * Date: 6/6/13
 * Time: 10:11 AM
 * To change this template use File | Settings | File Templates.
 */

var loader = {

    mmJsonLoader: function(url, callbackMethod, typeOfData){

        var xhr = new XMLHttpRequest();
        xhr.open('GET', url, true);
        xhr.setRequestHeader('Accept', 'application/perfsonar+json');
        xhr.onload = function(){

            if(xhr.status >= 200 && xhr.status < 300){ 
            
                var data = JSON.parse(xhr.responseText);
                callbackMethod(typeOfData, data);
            }
            else{
                console.log("Request " + url + " failed");
            }
        }
        xhr.send();

    },

    dataJsonLoader: function(url, callbackMethod, typeOfData, meta_id){

        var xhr = new XMLHttpRequest();
        xhr.open('GET', url, true);
        xhr.setRequestHeader('Accept', 'application/perfsonar+json');
        xhr.onload = function(){

            if(xhr.status >= 200 && xhr.status < 300){

                var data = JSON.parse(xhr.responseText);
                callbackMethod(typeOfData, data, meta_id);
            }
            else{
                console.log("Request " + url + " failed");
            }
        }
        xhr.send();
    }
};
