/**
 * Created with JetBrains WebStorm.
 * User: arzan
 * Date: 6/1/13
 * Time: 4:30 PM
 * To change this template use File | Settings | File Templates.
 */

var DataManager = new Class({

    unis_url: "",

    measurements_url: "/measurements?configuration.runningOn.href=",
    metadata_url: "/metadata?parameters.measurement=",
    data_url: "/data/",
    usePreemptiveLoading: false,
    metaRequested: 0,
    metaLoaded: 0,

    UNISData: {},

    /**
     * @author Adam McManigal
     * @param unis_url string URL where UNIS is running
     * @param preemptiveLoad boolean Specifies whether data should be front-loaded (optional)
     * @constructor
     */
    initialize: function(unis_url, preemptiveLoad)
    {
        this.unis_url = unis_url;
        if(preemptiveLoad)
            this.usePreemptiveLoading = preemptiveLoad;

    },

    /**
     * @author Adam McManigal
     * @param type string Data group to load.
     */
    loadAllOfType: function(type){

        switch(type){
            case 'nodes':
                this.makeUNISJSONRequest(this.unis_url + '/' + type, this.processNodes.bind(this));
                break;

        }

    },

    makeUNISJSONRequest: function(url, callbackMethod, nodeRef, metaRef){

        var xhr = new XMLHttpRequest();
        xhr.open('GET', url, true);
        xhr.setRequestHeader('Accept', 'application/perfsonar+json');
        xhr.onload = function(){

            if(xhr.status >= 200 && xhr.status < 300){

                var data = JSON.parse(xhr.responseText);
                callbackMethod(data, nodeRef, metaRef);
            }
            else{
                console.log("Request " + url + " failed");
            }
        }
        xhr.send();
        this.elementsLoaded++;
    },

    processNodes: function(data){

        for(var i = 0; i < data.length; i++)
        {

            if(data[i].selfRef)
            {
                var id = data[i].selfRef;

                if(!this.UNISData[id]){

                    this.UNISData[id] = new NodeDataPool(data[i]);
                    this.getNodeMeasurementData(id);
                }

            }
        }

    },



    getNodeMeasurementData: function(nodeRef){

        var request_url = this.unis_url + this.measurements_url + nodeRef;
        this.makeUNISJSONRequest( request_url, this.processNodeMeasurementData.bind(this), nodeRef );

    },

    processNodeMeasurementData: function(data, nodeRef){

        this.UNISData[nodeRef].addMeasurements(data, this.getMetadataData.bind(this));
        this.getMetadataData(nodeRef);

    },

    getMetadataData: function(nodeRef){

        var measurementsList = this.UNISData[nodeRef].getMeasurementList();
        var metadataURL = "";

        for( var i = 0; i <  measurementsList.length; i++){

            metadataURL = this.unis_url + this.metadata_url + measurementsList[i];
            this.makeUNISJSONRequest(metadataURL, this.processMetadata.bind(this), nodeRef);
            this.metaRequested++;

        }
    },

    processMetadata: function( data, nodeRef ){

        this.UNISData[nodeRef].addMetadata(data);

        this.metaLoaded++;

        this.UNISData[nodeRef].buildMetaIDNameList();
        this.getData( nodeRef );


    },

    getData: function( nodeRef ){

        var metaList = this.UNISData[nodeRef].getMetaIDList();
        console.log(metaList);
        /*
        for( var i = 0; i < metaList.length; i++ ){

            var dataQuery = this.unis_url + this.data_url + metaList[i];
            this.makeUNISJSONRequest( dataQuery, this.processData.bind(this), nodeRef, metaList[i] );

        }*/
    },

    processData: function(data, node, meta){

        console.log(data);
        this.UNISData[node].addData(data, meta);

    }






});