/**
 * @file 雷达图
 * @author chenwubai.cx@gmail.com
 */
(function(xCharts, d3) {
    var utils = xCharts.utils;
    var Chart = xCharts.charts.Chart;
git 
    // 创建radar构造函数
    function radar(messageCenter, config) {
        // 调用这一步的原因是为了继承属性
        Chart.call(this, messageCenter, config, 'radar');
    }

    // 在xCharts中注册radar构造函数
    xCharts.charts.extend({ radar: radar });
    // 从父类Chart里继承一系列的方法
    utils.inherits(radar, Chart);

    radar.prototype.extend = xCharts.extend;
    radar.prototype.extend({
        init: function(messageCenter, config, type, series) {

            // 提取雷达图配置项(目前不支持多图,直接忽略其他图表配置项)
            for(var i = 0, length = series.length; i < length; i++) {
                if(series[i].type === 'radar') {
                    this.radarConfig = utils.copy(series[i], true);
                    break;
                }
            }

            // 合并默认值,转换百分比为数值等
            __correctConfig.apply(this);

            // 计算网轴点坐标
            this.polygonWebs = __getPolygonWebs.apply(this);
            // 计算雷达图形的点坐标
            this.areas = __getAreas.apply(this);
            // 计算文字标签的点
            this.textPoints = __getTextPoints.apply(this);
            // 计算覆盖整个网轴的多边形的点坐标
            this.coverPolygons = __getCoverPolygons.apply(this);
        },
        render: function(animationEase, animationTime) {
            // 添加雷达图的g容器
            this.radar = __renderRadarWrapper.apply(this);
            // 添加网轴
            this.webList = __renderWebs.apply(this);
            // 添加网轴线
            this.lineList = __renderLines.apply(this);
            // 添加雷达图形
            this.areaList = __renderAreas.apply(this, [animationEase, animationTime]);
            // 添加文字标签
            this.textList = __renderText.apply(this);
            // 添加覆盖的多边形
            this.coverPolygonList = __renderCoverPolygons.apply(this);
        },
        ready: function() {
            if(this.config.legend && this.config.legend.show) {
                __legendReady.apply(this);
            }
            if(this.config.tooltip && this.config.tooltip.show) {
                __tooltipReady.apply(this);
            }
        }
    });
    function __correctConfig() {

        // 合并默认值
        this.radarConfig = utils.merage(defaultConfig(), this.radarConfig);

        // 计算图的中心坐标
        var center = this.radarConfig.center;
        if(typeof center[0] === 'string') {
            center[0] = parseFloat(center[0]) * 0.01 * this.width;
        }
        if(typeof center[1] === 'string') {
            center[1] = parseFloat(center[1]) * 0.01 * this.height;
        }
        // 计算最大的多边形的半径
        if(typeof this.radarConfig.radius === 'string') {
            this.radarConfig.radius = parseFloat(this.radarConfig.radius) * 0.01 * this.width;
        }
        // 添加对雷达图大小的处理,如果半径太大,自动把半径保持在可控的最大值
        var minLength = this.width < this.height ? this.width : this.height;
        // 减20是考虑到还有文字标签占着位置
        if(this.radarConfig.radius * 2 + 20 > minLength) {
            this.radarConfig.radius = (minLength - 20)/2 ;
        }
    }
    function __getPolygonWebs() {

        // 计算网轴多边形的点
        this.radarConfig.total = this.radarConfig.data[0].value.length;
        var onePiece = 2 * Math.PI/this.radarConfig.total;
        var polygonWebs = [];
        for(var k=this.radarConfig.levels;k>0;k--) {
            var web = '',
                points = [];
            var r = this.radarConfig.radius/this.radarConfig.levels * k;
            for(var i=0;i<this.radarConfig.total;i++) {
                var x = r * Math.sin(i * onePiece),
                    y = r * Math.cos(i * onePiece);
                web += x + ',' + y + ' ';
                points.push({ x: x, y: y });
            }
            polygonWebs.push({
                webString: web,
                webPoints: points
            });
        }
        return polygonWebs;
    }
    function __getAreas() {
        // 计算雷达图形的点
        var areas = [];
        for(var i=0; i<this.radarConfig.data.length;i++) {
            var d = this.radarConfig.data[i],
                max = this.radarConfig.indicator[i].max,
                min = this.radarConfig.indicator[i].min,
                area = '',
                points = [];
            for(var k=0;k< d.value.length;k++) {
                var x = this.polygonWebs[0].webPoints[k].x * d.value[k]/(max - min),
                    y = this.polygonWebs[0].webPoints[k].y * d.value[k]/(max - min);
                area += x + ',' + y + ' ';
                points.push({
                    x: x,
                    y: y,
                    // 增加一个属性存放原始属性,方便后面设置颜色
                    originalData: d
                });
            }
            areas.push({
                areaString: area,
                areaPoints: points,
                originalData: d,
                isShow: true
            });
        }
        return areas;
    }
    function __getTextPoints() {
        // 计算文字标签的点
        // TODO 优化文字标签分布
        var textPoints = [];
        var textRadius = this.radarConfig.radius + 20;
        for(var i=0;i<this.radarConfig.total;i++) {
            textPoints.push({
                x: textRadius/this.radarConfig.radius * this.polygonWebs[0].webPoints[i].x,
                y: textRadius/this.radarConfig.radius * this.polygonWebs[0].webPoints[i].y + 8
            });
        }
        return textPoints;
    }
    function __getCoverPolygons() {
        // 计算覆盖整个多边形网轴的多边形的坐标
        var webPoints = this.polygonWebs[0].webPoints;
        var coverPolygons = [];
        var length = webPoints.length;
        for(var i=0;i<length;i++) {
            var lastPoint = i==0 ? webPoints[length-1] : webPoints[i-1],
                currentPoint = webPoints[i],
                nextPoint = webPoints[(i+1)%length];
            var pointsStr = '0,0',
                points = [ {x:0, y:0} ];
            pointsStr += ' ' + (lastPoint.x+currentPoint.x)/2 + ',' + (lastPoint.y+currentPoint.y)/2;
            points.push({
                x: (lastPoint.x+currentPoint.x)/2,
                y: (lastPoint.y+currentPoint.y)/2
            });
            pointsStr += ' ' + currentPoint.x + ',' + currentPoint.y;
            points.push({
                x: currentPoint.x,
                y: currentPoint.y
            });
            pointsStr += ' ' + (currentPoint.x+nextPoint.x)/2 + ',' + (currentPoint.y+nextPoint.y)/2;
            points.push({
                x: (currentPoint.x+nextPoint.x)/2,
                y: (currentPoint.y+nextPoint.y)/2
            });
            coverPolygons.push({
                pointsStr: pointsStr,
                points: points,
                index: i
            });
        }
        return coverPolygons;
    }
    function __renderRadarWrapper() {
        var radar = this.main
            .selectAll('.xc-radar')
            .data([1]);
        radar.enter()
            .append('g')
            .classed('xc-radar', true);
        radar.attr('transform', 'translate(' + this.radarConfig.center[0] + ',' + this.radarConfig.center[1] + ')');
        return radar;
    }
    function __renderWebs() {
        var webs = this.radar
            .selectAll('.xc-radar-webs')
            .data([1]);
        webs.enter()
            .append('g')
            .classed('xc-radar-webs', true);
        var webList = webs.selectAll('.xc-radar-web')
            .data(this.polygonWebs);
        webList.enter()
            .append('polygon')
            .classed('xc-radar-web', true);
        webList.attr('points', function(d) { return d.webString; });
        return webList;
    }
    function __renderLines() {
        var lines = this.radar
            .selectAll('.xc-radar-lines')
            .data([1]);
        lines.enter()
            .append('g')
            .classed('xc-radar-lines', true);
        var lineList = lines.selectAll('.xc-radar-line')
            .data(this.polygonWebs[0].webPoints);
        lineList.enter()
            .append('line')
            .classed('xc-radar-line', true);
        lineList.attr({
            x1: 0,
            y1: 0,
            x2: function(d) {
                return d.x;
            },
            y2: function(d) {
                return d.y;
            }
        });
        return lineList;
    }
    function __renderAreas(animationEase, animationTime) {
        var _self = this;
        var areas = this.radar
            .selectAll('.xc-radar-areas')
            .data([1]);
        areas.enter()
            .append('g')
            .classed('xc-radar-areas', true);
        var areaList = areas.selectAll('.xc-radar-area')
            .data(this.areas);
        areaList.enter()
            .append('g')
            .attr('class', function(d, i) {
                return 'xc-radar-area xc-radar-area' + d.originalData.idx;
            });
        var polygonList = areaList.selectAll('polygon')
            .data(function(d) {
                return [d];
            });
        polygonList.enter()
            .append('polygon')
            .attr('points', function(d) {
                return Array.apply(0, Array(_self.radarConfig.total)).map(function() {
                    return '0,0';
                }).join(' ');
            })
            .style({
                stroke: function(d) {
                    if(!d.originalData.color) {
                        d.originalData.color = _self.getColor(d.originalData.idx);
                    }
                    return d.originalData.color;
                },
                fill: !this.radarConfig.fill ? '' : function(d) {
                    return d.originalData.color;
                }
            });
        polygonList.transition()
            .duration(animationTime)
            .ease(animationEase)
            .attr('points', function(d) {
                return d.areaString;
            });
        var pointsList = areaList.selectAll('.xc-radar-area-point')
            .data(function(d) {
                return d.areaPoints;
            });
        pointsList.enter()
            .append('circle')
            .classed('xc-radar-area-point', true)
            .attr({
                cx: 0,
                cy: 0
            })
            .style('stroke', function(d){
                return d.originalData.color;
            });
        pointsList.transition()
            .duration(animationTime)
            .ease(animationEase)
            .attr({
                cx: function(d) { return d.x; },
                cy: function(d) { return d.y; }
            });
        return areaList;
    }
    function __renderText() {
        var _self = this;
        var texts = this.radar
            .selectAll('.xc-radar-texts')
            .data([1]);
        texts.enter()
            .append('g')
            .classed('xc-radar-texts', true);
        var textList = texts.selectAll('.xc-radar-text')
            .data(this.textPoints);
        textList.enter()
            .append('text')
            .classed('xc-radar-text', true)
            .text(function(d, i) {
                return _self.radarConfig.indicator[i].text;
            })
            .attr('text-anchor', 'middle');
        textList.attr({
            x: function(d) { return d.x; },
            y: function(d) { return d.y; }
        });
        return textList;
    }
    function __renderCoverPolygons() {
        var coverPolygons = this.radar
            .selectAll('.xc-radar-coverPolygons')
            .data([1]);
        coverPolygons.enter()
            .append('g')
            .classed('xc-radar-coverPolygons', true);
        var coverPolygonList = coverPolygons.selectAll('.xc-radar-coverPolygon')
            .data(this.coverPolygons);
        coverPolygonList.enter()
            .append('polygon')
            .classed('xc-radar-coverPolygon', true);
        coverPolygonList.attr('points', function(d) {
            return d.pointsStr;
        });
        return coverPolygonList;
    }
    function __legendReady() {
        var _self = this,
            areas = _self.areas,
            mobileMode = this.messageCenter.mobileMode;
        if(mobileMode) {
            // TODO 去掉mouseenter和mouseleave的重复代码
            this.on('legendMouseenter.radar', function (name) {
                var areaData = {};
                for(var i=0;i<areas.length;i++) {
                    if(name == areas[i].originalData.name) {
                        areaData = areas[i];
                        break;
                    }
                }
                for(var i=0;i<_self.areaList[0].length;i++) {
                    var areaEle = d3.select(_self.areaList[0][i]);
                    if(areaEle.datum() == areaData) {
                        areaEle.selectAll('.xc-radar-area-point')
                            .style('stroke-width', 5);
                        break;
                    }
                }
            });
            this.on('legendMouseleave.radar', function(name) {
                var areaData = {};
                for(var i=0;i<areas.length;i++) {
                    if(name == areas[i].originalData.name) {
                        areaData = areas[i];
                        break;
                    }
                }
                for(var i=0;i<_self.areaList[0].length;i++) {
                    var areaEle = d3.select(_self.areaList[0][i]);
                    if(areaEle.datum() == areaData) {
                        areaEle.selectAll('.xc-radar-area-point')
                            .style('stroke-width', 3);
                        break;
                    }
                }
            });
        }
        this.on('legendClick.radar', function(nameList) {
            for(var i=0;i<_self.areas.length;i++) {
                _self.areas[i].isShow = false;
            }
            for(var i=0;i<nameList.length;i++) {
                for(var k=0;k<_self.areas.length;k++) {
                    if(nameList[i] == _self.areas[k].originalData.name) {
                        _self.areas[k].isShow = true;
                        break;
                    }
                }
            }
            for(var i=0;i<_self.areas.length;i++) {
                d3.select(_self.areaList[0][i]).classed('hidden', !_self.areas[i].isShow);
            }
        });
    }
    function __tooltipReady() {
        var _self = this,
            mobileMode = this.messageCenter.mobileMode;

        if(mobileMode) {
            // 移动端绑定click事件
            this.coverPolygonList.on('click.radar', function () {
                var index = d3.select(this).datum().index;
                _self.areaList.selectAll('.xc-radar-area-point').style('stroke-width', 3);
                __showTooltip.apply(_self, [index]);
            });
        } else {
            // PC端绑定hover事件
            this.coverPolygonList.on('mousemove.radar', function () {
                var index = d3.select(this).datum().index;
                __showTooltip.apply(_self, [index]);
            });
            this.coverPolygonList.on('mouseout.radar', function () {
                var tooltip = _self.messageCenter.components.tooltip;
                tooltip.hiddenTooltip();
                var areaPointsList = _self.areaList.selectAll('.xc-radar-area-point');
                areaPointsList.style('stroke-width', 3);
                _self.lineList.classed('xc-radar-tooltip-line', false);
            });
        }
    }
    function __showTooltip(index) {
        var tooltip = this.messageCenter.components.tooltip;
        var tooltipFormatter = tooltip.tooltipConfig.formatter,
            radarFormatter = this.radarConfig.formatter;
        var formatter = radarFormatter || tooltipFormatter || defaultFormatter;
        var event = d3.event;
        var x = event.layerX || event.offsetX,
            y = event.layerY || event.offsetY;
        var indicator = this.radarConfig.indicator[index].text;
        var valueList = [];
        for(var i=0;i<this.radarConfig.data.length;i++) {
            if(this.areas[i].isShow) {
                valueList.push({
                    name: this.radarConfig.data[i].name,
                    value: this.radarConfig.data[i].value[index]
                });
            }
        }
        tooltip.setTooltipHtml(formatter(indicator, valueList));
        tooltip.showTooltip();
        tooltip.setPosition([x,y], 10, 10);
        var areaPointsList = this.areaList.selectAll('.xc-radar-area-point');
        for(var i=0;i<areaPointsList.length;i++) {
            var areaPoints = areaPointsList[i];
            d3.select(areaPoints[index]).style('stroke-width', 5);
        }
        this.lineList.classed('xc-radar-tooltip-line', false);
        d3.select(this.lineList[0][index]).classed('xc-radar-tooltip-line', true);
    }
    function defaultFormatter(indicator, valueList) {
        var htmlStr = '';
        htmlStr += "<h3>" + indicator + "</h3>";
        for(var i=0;i<valueList.length;i++) {
            htmlStr += "<div>" + valueList[i].name + "：" + valueList[i].value + "</div>";
        }
        return htmlStr;
    }
    function defaultConfig() {
        /**
         * @var radar
         * @type Object
         * @extends xCharts.series
         * @description 雷达图配置项
         */
        var config = {
            /**
             * @var type
             * @type String
             * @description 指定图表类型
             * @values 'radar'
             * @extends xCharts.series.radar
             */
            type: 'radar',
            /**
             * @var levels
             * @type Number
             * @description 标记雷达图网轴有几层，取值必须为大于0的整数
             * @default 4
             * @extends xCharts.series.radar
             */
            levels: 4,
            /**
             * @var radius
             * @type Number|String
             * @description 定义雷达图的半径
             * @default '15%'
             * @extends xCharts.series.radar
             */
            radius: '15%',
            /**
             * @var fill
             * @type Boolean
             * @description 定义雷达图的区域是否填充，true为填充，false为不填充
             * @default false
             * @extends xCharts.series.radar
             */
            fill: false,
            /**
             * @var center
             * @type Array
             * @description 雷达图中心位置，可为百分比或数值。若为百分比则center[0]（中心x坐标）参照容器宽度，center[1]（中心y坐标）参照容器高度。
             * @default ['50%','50%']
             * @extends xCharts.series.radar
             */
            center: ['50%', '50%'],
            /**
             * @var indicator
             * @type Array
             * @description 雷达图各项指标
             * @extends xCharts.series.radar
             */
            indicator: [
                {
                    /**
                     * @var text
                     * @type String
                     * @description 指标名称
                     * @extends xCharts.series.radar.indicator
                     */
                    // text: '',
                    /**
                     * @var max
                     * @type Number
                     * @description 指标取值范围的最大值
                     * @extends xCharts.series.radar.indicator
                     */
                    max: 100,
                    /**
                     * @var min
                     * @type Number
                     * @description 指标取值范围的最大值
                     * @extends xCharts.series.radar.indicator
                     */
                    min: 0
                }
            ],
            /**
             * @var data
             * @type Array
             * @description 雷达图数据
             * @extends xCharts.series.radar
             */
            data: [
                {
                    /**
                     * @var name
                     * @type String
                     * @description 数据项名称
                     * @extends xCharts.series.radar.data
                     */
                    // name: '',
                    /**
                     * @var value
                     * @type Array
                     * @description 数据项对应所有指标的值的集合，其中的顺序必须和indicator中指标的顺序相对应。
                     * @extends xCharts.series.radar.data
                     */
                    // value: []
                }
            ]
        }
        return config;
    }
}(xCharts, d3));