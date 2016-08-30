var express  	= require('express');
var app     	= express();
var http 		= require('http');
var path 		= require('path');
var bodyParser 	= require('body-parser');
var q			= require('kew');
var couchbase 	= require('couchbase');
var N1qlQuery 	= couchbase.N1qlQuery;

var clusters = {};

app.use("/bower_components", express.static(__dirname + "/public/bower_components"));
app.use("/js", express.static(__dirname + "/public/js"));
app.use("/css", express.static(__dirname + "/public/css"));

app.use(bodyParser.urlencoded({'extended':'true'}));
app.use(bodyParser.json());
app.use(bodyParser.json({ type: 'application/vnd.api+json' }));

app.post("/api/map/:collection", function(req, res) {

	var db = {
		server: req.header('server'),
		bucket: req.header('bucket'),
		password: req.header('password')
	}

	var collection = req.params.collection;
	var query = req.body.query;
	var mapFunction = req.body.mapFunction;

	if(req.query.preview) {
		preview(db, collection, query, mapFunction).then(function(response) {
			res.status(200).json(response);
		}).fail(function(err) {
			res.status(500).json({message: err});
		}).done();
	} else {
		update(db, collection, query, mapFunction).then(function(response) {
			res.status(200).json(response);
		}).fail(function(err) {
			res.status(500).json({message: err});
		}).done();
	}
});

app.all('/*', function(req, res) {
	res.sendFile('index.html', { root: path.join(__dirname, './public') });
});

var server = http.createServer(app).listen(process.env.PORT || 8085, function() {
	var host = server.address().address;
	host = host === '::' ? '[' + host + ']' : host;
	var port = server.address().port;
	console.log('couchbase advanced client started. listening at http://%s:%s', host, port);
});

function update(db, collection, query, mapFunction) {

	var bucket = getBucket(db);

	var defer = q.defer();
	
	query = N1qlQuery.fromString("SELECT *, meta() AS `path` FROM `" + db.bucket + "` WHERE _collection=\"" + collection + "\" AND " + query);

    q.ncall(bucket.query, bucket, query).then(function(response) {
    	onResponse(db, bucket, response, mapFunction, defer)
		.then(function(res) {
			bucket.disconnect();
			defer.resolve({message: 'success !'});
		}).fail(function(err) {
			bucket.disconnect();
			defer.reject(err);
		}).done();
    }).fail(function(err) {
        defer.reject(err);
    }).done();
    
    return defer.promise;
}

function onResponse(db, bucket, response, mapFunction, defer) {
	
	var updates = [];
    
	var f = new Function('id', 'value', mapFunction);
	response.forEach(function(result) {
		updated = f(result.path.id, result[db.bucket]);
		updates.push(q.ncall(bucket.replace, bucket, result.path.id, updated));
	});
	
	return q.all(updates);
}

function preview(db, collection, query, mapFunction) {

	var bucket = getBucket(db);

	var defer = q.defer();

	query = N1qlQuery.fromString("SELECT *, meta() AS `path` FROM `" + db.bucket + "` WHERE _collection=\"" + collection + "\" AND " + query);

    q.ncall(bucket.query, bucket, query).then(function(response) {

    	var total = response.length;
    	
    	var originalValues = response.map(function(result) {
    		return JSON.parse(JSON.stringify(result[db.bucket]));
    	});
    	
    	var f = new Function('id', 'value', mapFunction);
    	var updatedValues = response.map(function(result) {
    		try {
				return f(result.path.id, result[db.bucket]);
    		} catch(err) {
    			defer.reject(err);
    			throw err;
    		}
    	});
    	
    	var diffs = [];
    	for(var i = 0; i < originalValues.length; i++) {
    		diffs.push({before:originalValues[i], after:updatedValues[i]});
    	}

		bucket.disconnect();
		defer.resolve({count:total, diffs:diffs});
    	
    }).fail(function(err) {
		bucket.disconnect();
        defer.reject(err);
    }).done();
    
    return defer.promise;
}

function getBucket(db) {
	if(!clusters[db.server]) {
		clusters[db.server] = new couchbase.Cluster('couchbase://' + db.server);
	} 

	return clusters[db.server].openBucket(db.bucket, db.password);
}
