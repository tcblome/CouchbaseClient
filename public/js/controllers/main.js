aoc.controller("main", function($scope, $http, $localStorage, $confirm) {
	
	$scope.mapFunction = "return value;";
	
	$scope.isPreview = false;
	
	if(!$localStorage.history) { $localStorage.history = []; }
	$scope.history = $localStorage.history;
	
	$scope.fromHistory = function(story) {
		$scope.server = story.s;
		$scope.bucket = story.b;
		$scope.password = story.p;
		$scope.collection = story.c;
		$scope.query = story.q;
		$scope.mapFunction = story.f;
		$scope.isHistory = false;
	}
	
	$scope.deleteHistory = function(index) {
	      $confirm({text: 'Are you sure you want to delete this item from the History?', title: 'Delete Confirmation'})
	        .then(function() {
	          $scope.deletedConfirm = 'Deleted';
	          	$localStorage.history.splice(index, 1);
	        });	
	}
	
	$scope.preview = function() {
		
		var s = {s:$scope.server, b:$scope.bucket, p:$scope.password, c:$scope.collection, q:$scope.query, f:$scope.mapFunction}
	
		var index = -1;
	    for(var i = 0, len = $localStorage.history.length; i < len; i++) {
	    	var e = $localStorage.history[i];
	    	if(e.s === s.s && e.b === s.b && e.p === s.p && e.c === s.c && e.q === s.q && e.f === s.f) {
	    		index = i;
	    		break;
	    	}
	    }
	  
	    if(index >= 0) {
	    	if(index != 0) {
				$localStorage.history.splice(0, 0, $localStorage.history.splice(index, 1)[0]);	
	    	}
	    } else {
			$localStorage.history.unshift(s);
	    }
		
		$scope.isPreview = false;
		$scope.diffs = [];
		
		var body = {
			query: $scope.query,
			mapFunction: $scope.mapFunction
		}
		
		$http.post('api/map/' + $scope.collection + '?preview=1', body, {headers: {server:$scope.server, bucket:$scope.bucket, password:$scope.password}})
			.then(function(response) {
				$scope.isPreview = true;
				$scope.count = response.data.count;
				$scope.diffs = response.data.diffs.map(function(diff) {
					var before = diff.before ? JSON.stringify(diff.before) : '';
					var after = diff.after ? JSON.stringify(diff.after) : '';
					return {before: before, after: after};
				})
			}, function(response) {
				console.log(response.data);
			});
		
	};
	
	$scope.apply = function() {
		var body = {
			query: $scope.query,
			mapFunction: $scope.mapFunction
		}
		
		$http.post('api/map/' + $scope.collection, body, {headers: {server:$scope.server, bucket:$scope.bucket, password:$scope.password}})
			.then(function(response) {
				console.log(response.data);
			}, function(response) {
				console.log(response.data);
			});
	};
		
    $scope.options = {
		editCost: 4,
		attrs: {
		  insert: {
			'data-attr': 'insert',
			'class': 'insertion'
		  },
		  delete: {
			'data-attr': 'delete'
		  },
		  equal: {
			'data-attr': 'equal'
		  }
		}
    };
})
