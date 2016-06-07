/**
 * Author liuyang46@meituan.com
 * Date 16/5/27
 * Describe 散点图,移动端适配
 */

(function (xCharts, d3) {
    var utils = xCharts.utils;
    var charts = xCharts.charts;
    var scatter = charts.scatter;

    scatter.prototype.extend({
        mobileReady:function(){
            var moveEvent = scatter.assitLineTrigger(this);
            this.div.on('touchmove.scatter',moveEvent);
            this.div.on('touchstart.scatter',moveEvent);
        }
    });
}(xCharts, d3));
