/*VPA STAT Widget*/

;(function($){
 	"use scrict";

    jQuery.fn.statWidget = function (options) {

        //set default options 
        var _defaults = {
            input: function () { return true; },//TODO
            chartType: 'bar',
            labels: []
        };

        //call in the default otions
        var _options = $.extend(_defaults, options);

        //#region DUMMY DATA
        window.chartColors = {
            red: 'rgb(255, 99, 132)',
            orange: 'rgb(255, 159, 64)',
            yellow: 'rgb(255, 205, 86)',
            green: 'rgb(75, 192, 192)',
            blue: 'rgb(54, 162, 235)',
            purple: 'rgb(153, 102, 255)',
            grey: 'rgb(201, 203, 207)'
        };
        window.randomScalingFactor = function () {
            return (Math.random() > 0.5 ? 1.0 : -1.0) * Math.round(Math.random() * 100);
        };
        var color = Chart.helpers.color;

        var _datasets = [];
        if (_options.chartType == "pie") {
            _datasets.push({
                label: '2020',
                backgroundColor: color(window.chartColors.blue).alpha(0.5).rgbString(),
                borderColor: window.chartColors.red,
                borderWidth: 1,
                data: [
                    randomScalingFactor(),
                    randomScalingFactor(),
                    randomScalingFactor(),
                    randomScalingFactor(),
                    randomScalingFactor(),
                    randomScalingFactor(),
                    randomScalingFactor()
                ]
            });
        }
        else {
            _datasets.push({
                label: '2020',
                backgroundColor: color(window.chartColors.red).alpha(0.5).rgbString(),
                borderColor: window.chartColors.red,
                borderWidth: 1,
                data: [
                    randomScalingFactor(),
                    randomScalingFactor(),
                    randomScalingFactor(),
                    randomScalingFactor(),
                    randomScalingFactor(),
                    randomScalingFactor(),
                    randomScalingFactor()
                ]
            });
            _datasets.push({
                label: '2021',
                backgroundColor: color(window.chartColors.blue).alpha(0.5).rgbString(),
                borderColor: window.chartColors.blue,
                borderWidth: 1,
                data: [
                    randomScalingFactor(),
                    randomScalingFactor(),
                    randomScalingFactor(),
                    randomScalingFactor(),
                    randomScalingFactor(),
                    randomScalingFactor(),
                    randomScalingFactor()
                ]
            });
        }

        var chartData = {
            labels: _options.labels,
            datasets: _datasets
        };

		//#endregion DUMMY DATA

		//widget element
		var $widget = $(this)[0];
        var chart = null;

		var init = function () {

            //add chartjs canvas to widget
            var canvas = document.createElement("canvas");
            $(".grid-stack-item-content", $widget).html("");
            $(".grid-stack-item-content", $widget).append(canvas);

            var ctx = canvas.getContext("2d");
            chart = new window.Chart(ctx, {
                type: _options.chartType,
                data: chartData,
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    legend: {
                        position: 'top',
                    }
                }
            });
		};

		init();

	};
})(jQuery);
