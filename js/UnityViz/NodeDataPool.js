/**
 * Created with JetBrains WebStorm.
 * User: arzan
 * Date: 6/1/13
 * Time: 7:05 PM
 * To change this template use File | Settings | File Templates.
 */

var NodeDataPool = new Class({

    nodeData: undefined,
    measurementsData: {},
    measurementRefIndex: {},
    metaIDLookup: {},
    metaIDNameList: [],

    measureTypeToData: {},

    measurementsList: [],
    metadataList: [],



    lastUpdateTime: undefined,


    initialize: function(node_data){

        this.nodeData = node_data;
    },

    getNodeRef: function(){

        return this.nodeData.selfRef;
    },

    getMetaIdNameList: function(){

        return this.metaIDNameList;
    },

    getMeasurementList: function(){

    },

    buildMeasurementList: function(){

        var list = [];

        for(var n in this.measurementsData)
        {
            list.push(n);
        }

        return list;
    },


    buildMetaIDNameList: function(){

        for(var n in this.metaIDLookup)
        {
            this.metaIDNameList.push(n);
        }

    },


    /**
     * @author Adam McManigal
     * @description Adds a list of measurements being recorded for the node.
     * @param measurement array List of measurements to add.
     * @param callback Callback to alert that DataManager that processing is done.
     */
    addMeasurements: function(measurement, callback){

        for ( var i = 0; i < measurement.length; i++)
        {
            var measureRef = measurement[i].selfRef;
            var measureType = measurement[i].configuration.name;

            //Organizes the measurements by the measurement reference.
            this.measurementsData[measureRef] = {};

            //Creates a new category list if needed.
            if( !this.measurementRefIndex[measureType])
                this.measurementRefIndex[measureType] = [];

            if( !this.measurementsData[measureRef])
                this.measurementsData[measureRef] = {};

            //Indexes type of measurement for quick GUI lookup.
            this.measurementRefIndex[measureType].push(measureRef);

            //Indexes the event types by the measurement index.
            for(var n = 0; n < measurement[i].eventTypes.length; n++){

                var event = measurement[i].eventTypes[n];
                this.measurementsData[measureRef][event] = {};
            }

        }

        console.log(this);
    },

    //measurementsData.measureRef
    addMetadata: function(metadata){
        if(metadata.length){

            for(var i = 0; i < metadata.length; i++)
            {
                var measureRef = metadata[i].parameters.measurement;
                var event = metadata[i].eventType;
                var metaID = metadata[i].id;

                this.measurementsData[measureRef][event] = metaID;
                this.metaIDLookup[metaID] = [];
            }
        }

    },

    addData: function(data, metadataRef){

        this.metaIDLookup[metadataRef] = data;

    }



});