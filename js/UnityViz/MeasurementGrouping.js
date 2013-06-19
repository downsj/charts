/**
 * Created with JetBrains WebStorm.
 * User: arzan
 * Date: 6/6/13
 * Time: 9:43 AM
 * To change this template use File | Settings | File Templates.
 */


var MeasurementsGrouping = new Class({

    //The UNIS server URL
    unis_href: "",

    //The node that this measurement grouping belongs to...
    node_href:  "",

    //Queries for data
    measurements_url: "/measurements?configuration.runningOn.href=",
    metadata_url: "/metadata?parameters.measurement=",
    data_url: "/data/",


    //Links the measurement id to the grouping of events the measurement monitors.
    //e.g. http://dev.incntre.iu.edu/measurements/51af627ee779890f1f0002b7 -> cpu
    measureHrefToMeasureType: {},

    //Links the measurement group to the measurement IDs (stored in array). This is used for GUI lookup functions
    //e.g. cpu -> [http://dev.incntre.iu.edu/measurements/51af627ee779890f1f0002b7
    measureTypeToMeasureHref: {},

    //General measurement (measurement type) to an array of events (event types)
    //e.g. cpu -> [ps:tools:blipp:linux:cpu:load:fifteenmin , ps:tools:blipp:linux:cpu:load:fivemin, ...]
    measureTypeToEvents: {},

    //Specific event (ps:tools:blipp:linux:cpu:load:fifteenmin) to the metadata ID for that event.
    //e.g. ps:tools:blipp:linux:cpu:load:fifteenmin -> "51af6283e779890f1f0002c3"
    eventToMetaID: {},

    //Metadata id to a data array for that event.
    //e.g. 51af6283e779890f1f0002c3 -> [54363425 , 2545345, 2352432 ,...]
    dataStore: {},

    //The function that the measurementGrouping uses to make JSONRequests
    loader: undefined,
    autoLoad: true,


    /**
     * @author Adam McManigal
     * @param unis_href string The hyperlink for the UNIS server.
     * @param nodeHref string The url of the node these measurements relate to.
     * @param jsonLoader function The function to use for loading JSON.
     * @constructor
     */
    initialize: function(unis_href, node_href, jsonLoader){

        this.unis_href = unis_href;
        this.node_href = node_href;
        this.loader = jsonLoader;


    },

    /**
     * @author Adam McManigal
     * @description Loads measurement data for the node.
     * @param loadAll boolean Automatically loads all associated data if set to true.
     */
    loadData: function(callBack,loadAll){

        this.loadingSync('measurement', this.node_href);
        /*
        var query = this.unis_href + this.measurements_url + this.node_href;
        this.mUNISJSONLoader(query, this.processData.bind(this), 'measurement')
        console.log(query);
        */
    },

    /**
     * @author Adam McManigal
     * @description Keeps the rules for database queries (terms and callback methods) in one place.
     * @param dataType string Choose 'measurement', 'metadata', or 'data'.
     * @param searchTerm string Uses node refs for measurements, measurement refs for metadata, and metadata id for data.
     */
    loadingSync: function(dataType, searchTerm){

        switch(dataType){
            case 'measurement':
                var query = this.unis_href + this.measurements_url + searchTerm;
                this.loader.mmJsonLoader(query, this.processReply.bind(this), 'measurement');
                break;
            case 'metadata':
                var query = this.unis_href + this.metadata_url + searchTerm;
                this.loader.mmJsonLoader(query, this.processReply.bind(this), 'metadata');
                break;
            case 'data':
                var query = this.unis_href + this.data_url + searchTerm;
                this.loader.dataJsonLoader(query, this.processReply.bind(this), 'data', searchTerm);
                break;
            default:
                console.log("MeasurementGrouping for Node: " + this.node_href + "\n\tError: Invalid Data Type")
        }

    },

    /**
     * @author Adam McManigal
     * @description The default callback for processing requested information.
     * @param data Object The parsed JSON object,
     * @param dataType string Used to determine the type of data.
     */
    processReply: function(dataType, data, identifier){

        switch(dataType){
            case 'measurement':
                this.processMeasurements(data);
                break;
            case 'metadata':
                this.processMetadata(data);
                break;
            case 'data':
                this.processData(data, identifier);
                break;
            default:
                console.log("MeasurementGrouping for Node: " + this.node_href + "\n\tError: Data Type Unrecognized")
        }
    },

    /**
     * @author Adam McManigal
     * @description Processes the measurements for the node, allowing the measurements to be easily sorted.
     * @param data Object[] Parsed measurement data for a node (http://unis.incntre.iu.edu/schema/20120709/metadata)
     */
    processMeasurements: function(data){

        var newest = this.findNewest(data, 'configuration.name', 'ts');

        //Determines the newest entry
        for ( var n in newest)
        {
            //Classifies the measurement refs by the measurement type.
            this.measureTypeToMeasureHref[n] = newest[n].selfRef;

            //Classifies the measurements by the measurement reference.
            this.measureHrefToMeasureType[newest[n].selfRef] = n;

            //Creates arrays of events based on what's being measured.
            this.measureTypeToEvents[n] = newest[n].eventTypes;

            //Begins loading metadata if autoLoad is enabled
            if(this.autoLoad){
                this.loadingSync('metadata', newest[n].selfRef);
            }

        }
    }.protect(),

    /**
     * @author Adam McManigal
     * @description Stores references to metadata that are needed to retrieve data in the eventToMetaID lookup.
     * @param data Object[] An array of parsed metadata for a measurement.
     */
    processMetadata: function(data){

        var event;
        var metaID;
        var newest = this.findNewest(data, "eventType", "ts");

        for( var n in newest)
        {
            this.eventToMetaID[n] = newest[n].id;
            this.loadingSync('data', newest[n].id);
        }

    }.protect(),

    /**
     * @author Adam McManigal
     * @description Stores data values for an event (metadata) in the dataStore lookup
     * @param data Object[] An array of parsed data for a metadata record.
     */

    processData: function(data, meta_id){

        this.dataStore[meta_id] = [];

        for( var i = 0; i < data.length; i++)
        {
            this.dataStore[meta_id].push(data[i].value);
        }
    },

    /**
     * @author Adam McManigal
     * @description Removes needless redundancy by removing older versions of retrieved objects.
     * @param data Object[] An array of parsed JSON objects
     * @param key string The path to the object id (i.e. configuration.name)
     * @param compare string The property to use for comparisons (i.e. ts)
     */
    findNewest: function(data, key, compare){

        //Stores the newest entry for each category
        var newest = {}; //data[spot] of newest

        //Determine the newest measurements object for each category.
        for ( i = 0; i < data.length; i++ )
        {
            var measureType = eval("data[i]." + key);

            if( !newest[measureType] )
            {
                //If the dictionary is empty, store the first reference.
                newest[measureType] = data[i];
            }
            else
            {
                var currentNewest = eval("newest[measureType]." + compare);
                var possibleNewest = eval("data[i]." + compare);

                //Compare the times and replace the reference if the new time is lower.
                if(currentNewest < possibleNewest)
                    newest[measureType] = data[i];
            }
        }

        return newest;
    }.protect()




});
