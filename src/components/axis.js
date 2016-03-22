/**
 * xCharts.axis
 * 坐标系绘制函数
 * TODO brush时间刷
 */
(function (window) {
    var xCharts = window.xCharts;
    var utils = xCharts.utils;
    var d3 = window.d3;
    var components = xCharts.components;
    utils.inherits(axis, components['Component']);
    components.extend({axis: axis});

    function axis(messageCenter, config, type) {
        /**
         * 这里跟其他组件不一样，即使用户不愿意显示坐标轴，也必须初始化(init)，不然其他图表会拿不到比例尺导致绘图失败
         */
        this._show = true;
        components['Component'].call(this, messageCenter, config, type);

    }

    axis.prototype.extend = xCharts.extend;
    axis.prototype.extend({
        //一些初始化参数的计算
        init: function (messageCenter, config, type, series) {
            this.isXAxis = type === 'xAxis';
            this.axisConfig = config[type];
            this.series = series;

            var scales = [];
            for (var i = 0; i < this.axisConfig.length; i++) {

                // 合并默认config
                var config = utils.merage(defaultConfig(type), this.axisConfig[i]);

                // 计算需要显示的文字的宽高，y轴是宽，x轴是高

                // 计算比例尺scale
                var scale = axisScale(config, i, this);

                // 这里判断，如果domain是NAN证明是legend取消了所有显示，保持上一个不变
                var doamin = scale.domain();
                if (isNaN(doamin[0]) && isNaN(doamin[1]) && scale.scaleType==='value') scale = this.scales[i];

                if (!this.legendRefresh) calcAxisMargin(this, this.isXAxis, config, scale);


                this.axisConfig[i] = config;


                scales[i] = scale;

                this.axisConfig[i] = config;
            }

            this.width = messageCenter.originalWidth - messageCenter.margin.left - messageCenter.margin.right; //计算剩余容器宽
            this.height = messageCenter.originalHeight - messageCenter.margin.top - messageCenter.margin.bottom;//计算剩余容器高
            this.range = this.isXAxis ? [0, this.width] : [this.height, 0];

            setScaleRange(scales, this.range);

            this.messageCenter[this.type + 'Scale'] = scales;
            this.scales = scales;

        },
        render: function (animationEase, animationTime) {
            var type = this.type;
            var scales = this.scales;

            for (var i = 0, config; config = this.axisConfig[i]; i++) {

                if (!config.show) break; //不显示坐标

                var scale = scales[i];

                // d3内置函数,生成axis
                var axis = d3.svg.axis()
                    .scale(scale)
                    .orient(config.position)
                    .tickFormat(config.tickFormat);

                //添加<g>
                var axisGroup = this.main.selectAll(".xc-axis." + type + '-' + i).data([config]);

                axisGroup.enter().append('g')
                    .attr('class', 'xc-axis ' + type + '-' + i)
                    .attr('fill', 'none')
                    .attr('stroke', '#000');

                axisGroup.attr('transform', translate.call(this, config))
                    .transition()
                    .ease(animationEase)
                    .duration(animationTime)
                    .call(axis);


            }
        },
        ready: function () {

            this._tooltipReady();
            this._lengendReady();
        },
        _tooltipReady: function () {

            //有些情况不需要加载tooltip事件
            if (!this.config.tooltip || this.config.tooltip.show === false || this.config.tooltip.trigger !== 'axis' || this.type == 'yAxis') return;

            //默认已经是单x轴,且type！=value

            var axis = this.axisConfig[0];
            this.on('tooltipSectionChange.axis', function (sectionNumber, callback) {
                var data = axis.data[sectionNumber];
                var html = axis.formatter(data);

                callback(html);
            });

        },
        _lengendReady: function () {
            var _this = this;
            this.on('legendClick.' + _this.type, function (nameList) {
                var series = _this.series;
                series.forEach(function (serie) {
                    var serieName = serie.name;
                    serie.show = false;
                    for (var i = 0, n; n = nameList[i++];) {
                        if (n == serieName) {
                            serie.show = true;
                            break;
                        }
                    }

                });
                // 给个标识，这样就不用去计算margin的值
                _this.legendRefresh = true;
                _this.init(_this.messageCenter, _this.config, _this.type, series);
                _this.render(_this.config.animation.animationEase, _this.config.animation.animationTime);
                _this.legendRefresh = false;
            });
        }
    });

    /**
     * 设置scale
     * @param scales
     */
    function setScaleRange(scales, range) {

        scales.forEach(function (scale) {
            if (scale.scaleType === "value" || scale.scaleType === "time") scale.range(range);
            else if (scale.scaleType === "barCategory") scale.rangeRoundBands(range, 0, 0.1);
            else if (scale.scaleType === "category")  scale.rangeRoundPoints(range);

        });
    }

    /**
     * 计算y轴时，需要偏移的margin值
     * @param ctx
     * @param isXAxis
     * @param config
     * @param scale
     */
    function calcAxisMargin(ctx, isXAxis, config, scale) {

        // 只处理Y轴，X轴高度基本不会变化
        if (!isXAxis) {
            var ticksTextList = scale.ticks().map(function (tickText) {
                return config.tickFormat(tickText);
            });
            // 这里默认14的字体大小，也不知道有没有影响，囧
            var widthList = utils.calcTextWidth(ticksTextList, 14).widthList;
            var maxWidth = d3.max(widthList);

            maxWidth = maxWidth == undefined ? 0 : maxWidth;

            if (config.position === 'right') {
                ctx.margin.right += maxWidth;
            } else {
                ctx.margin.left += maxWidth;
            }
        }


    }

    /**
     * 包含坐标轴类型
     */
    var axisCategory = {
        value: valueAxis,
        time: timeAxis,
        category: categoryAxis
    }

    /**
     * 入口
     * @param singleConfig
     * @param idx
     * @param ctx
     * @returns {*}
     */
    function axisScale(singleConfig, idx, ctx) {
        var axisClass = axisCategory[singleConfig.type];
        if (!axisClass) {
            console.error('axis[%d].type = "%s" is not supported', idx, singleConfig.type);
            return;
        }

        return axisClass.call(ctx, singleConfig, idx);

    }

    /**
     * category类型
     * @param singleConfig
     * @param idx
     * @returns {*}
     */
    function categoryAxis(singleConfig, idx) {

        if (!singleConfig.data) {
            console.error('axis[%d].data is not defined!', idx);
            return;
        }

        if (isBar(this.config.series)) {
            var scale = d3.scale.ordinal()
                .domain(singleConfig.data);


            scale.scaleType = "barCategory";

        } else {
            var scale = d3.scale.ordinal()
                .domain(singleConfig.data);


            scale.scaleType = "category";
        }

        return scale;

    }

    /**
     * value类型
     * @param singleConfig
     * @param idx
     * @returns {*}
     */
    function valueAxis(singleConfig, idx) {

        var series = this.series;
        var type = this.type;
        //默认指向index=0的坐标轴
        series.map(function (serie) {
            if (serie[type + 'Index'] == null) {
                serie[type + 'Index'] = 0;
            }
        });

        var values = [], domain = [];
        for (var k in axisSeries) {
            if (axisSeries.hasOwnProperty(k)) {
                var value = axisSeries[k](series, type, idx);
                if (value) {
                    values.push(value);
                }
            }

        }
        domain[0] = d3.min(values, function (value) {
            return value[0]
        });
        domain[1] = d3.max(values, function (value) {
            return value[1]
        });

        // 虽然设置轴，但是并没有使用，查看是否设置了最大最小值
        //if(domain[0] === undefined){
        //    domain[0] = singleConfig.min;
        //    domain[1] = singleConfig.max;
        //}

        // 如果最大最小值是相等的,手动将domain的一个值设为0
        if (domain[0] === domain[1]) {
            domain[0] > 0 ? domain[0] = 0 : domain[1] = 0;
        }

        // domain 上下添加0.1的偏移，参考至c3
        var valueLength = domain[1] - domain[0];
        domain[0] -= valueLength * 0.1;
        domain[1] += valueLength * 0.1;

        //用户手动控制最大最小值
        if (domain[0] > singleConfig.minValue) {
            domain[0] = singleConfig.minValue;
        }
        if (domain[1] < singleConfig.maxValue) {
            domain[1] = singleConfig.maxValue;
        }


        var scale = d3.scale.linear()
            .domain(domain);


        scale.scaleType = "value";

        return scale;
    }

    /**
     * time类型
     * @param singleConfig
     * @param idx
     * @returns {*}
     */
    function timeAxis(singleConfig, idx) {

        var scale = d3.time.scale()
            .domain(d3.extent(singleConfig.data, function (d) {
                return +new Date(d);
            }));

        //现在只考虑x坐标轴
        if (this.isXAxis) {
            //取得series中data的长度，均分domain,保证singleConfig.data长度一致
            var series = this.config.series;
            var dataLength = 1;
            for (var i = 0, serie; serie = series[i++];) {
                // 这里只支持折线图，暂不考虑其他
                var xIndex = serie.xAxisIndex == undefined ? 0 : serie.xAxisIndex;
                if (serie.type == 'line' && xIndex == idx) {
                    dataLength = serie.data.length - 1;
                    break;
                }
            }

            var domain = scale.domain(),
                timeDifference = domain[1] - domain[0], //最大最小时间差
                sectionTime = timeDifference / dataLength;//时间与时间之间的间隔

            singleConfig.data = [+domain[0]];
            for (var i = 0; i < dataLength; i++) {
                singleConfig.data[i + 1] = +domain[0] + Math.round(sectionTime * (i + 1), 1);
            }
        }
        scale.scaleType = "time";

        return scale;
    }


    //因图表类型而异，取得对应的最大最小值
    //需对每个series指定了xAxisIndex 或者 yAxisIndex
    //@return 数组[min,max]
    var axisSeries = {
        line: function (series, type, idx) {
            var stacks = {}, values = [];
            d3.map(series, function (serie) {
                if (serie.type != 'line' || serie[type + 'Index'] != idx || serie.show == false) {
                    return false;
                }
                if (serie.stack) {
                    stacks[serie.stack] || (stacks[serie.stack] = [])
                    stacks[serie.stack].push(serie.data);
                }
                values = values.concat(serie.data);
            })
            //处理堆积图，值相加
            for (var k in stacks) {
                if (stacks.hasOwnProperty(k)) {
                    var maxData = [];
                    stacks[k].forEach(function (data, i) {
                        data.forEach(function (d, i) {
                            maxData[i] = maxData[i] == null ? 0 : maxData[i];//默认为0
                            maxData[i] += d;
                        })
                    })
                    values = values.concat(maxData);

                }
            }

            return values.length == 0 ? false
                : d3.extent(values, function (value) {
                return parseFloat(value);
            })
        },
        bar: function (series, type, idx) {
            var stacks = {}, values = [];
            d3.map(series, function (serie) {
                if (serie.type != 'bar' || serie[type + 'Index'] != idx || serie.show == false) {
                    return false;
                }
                if (serie.stack) {
                    stacks[serie.stack] || (stacks[serie.stack] = [])
                    stacks[serie.stack].push(serie.data);
                }
                values = values.concat(serie.data);
            })
            for (var k in stacks) {
                if (stacks.hasOwnProperty(k)) {
                    var maxData = [];
                    stacks[k].forEach(function (data, i) {
                        data.forEach(function (d, i) {
                            maxData[i] = maxData[i] == null ? 0 : maxData[i];//默认为0
                            maxData[i] += d;
                        })
                    })
                    values = values.concat(maxData);

                }
            }
            return values.length == 0 ? false
                : d3.extent(values, function (value) {
                return parseFloat(value);
            })
        },
        scatter: function (series, type, idx) {
            var values = [];
            d3.map(series, function (serie) {
                if (serie.type != 'scatter' || serie[type + 'Index'] != idx || serie.show == false) {
                    return;
                }
                d3.map(serie.data, function (d) {
                    values.push(d[type == 'xAxis' ? 0 : 1]); //[[161.2, 51.6]]包含x，y值的数组,第一个为x，第二个为y
                })
            });

            return values.length == 0 ? false
                : d3.extent(values, function (value) {
                return parseFloat(value);
            })
        }
    }

    /**
     * 根据作为位置返回需要偏移的坐标量
     * @param config
     * @returns {string} translate(0,0)
     */
    function translate(config) {
        var position = config.position;
        var xy = [0, 0];

        if (position == 'right')
            xy = [this.width, 0];
        else if (position == 'bottom')
            xy = [0, this.height];
        return 'translate(' + xy + ')';
    }


    function isBar(series) {
        for (var i = 0, s; s = series[i++];)
            if (s.type === 'bar')
                return true;

        return false;
    }

    function defaultConfig(type) {
        //注释掉是因为该项没有默认值,非必须或者必须由用户指定

        /**
         * @var axis
         * @type Object
         * @description 坐标轴配置项
         * @extends xCharts
         */
        var axis = {
            /**
             * @var type
             * @extends xCharts.axis
             * @description 坐标轴的类型
             * @type String
             * @values 'category'|'value'|'time'
             */
            //type:'value',
            /**
             * @var data
             * @extends xCharts.axis
             * @type Array
             * @description
             *  依赖于type类型
             *  type=value时,data值无效
             *  type=category时，data里的值为String|Number
             *  type=time时,data里是可以被new Date()识别的值
             * @example data:[1,2,3] data:['周一','周二','周三']
             */
            //data:[], //当type=category,time时，指定坐标轴的值
            /**
             * @var tickFormat
             * @extends xCharts.axis
             * @type Function
             * @description
             * 对坐标轴上的每一个label进行格式化,需要返回一个字符串作为显示
             * @example
             *  function(value){
             *      return value+'%';
             *  }
             *  @default 不做任何处理
             */
            tickFormat: utils.loop,
            /**
             * @var formatter
             * @extends xCharts.axis
             * @type Function
             * @description
             * 对坐标轴上的每一个label进行格式化,需要返回一个字符串作为tooltip的title字段
             * @example
             *  function(value){
             *      return value+'%';
             *  }
             *  @default 调用tickFormat进行处理,两边包裹<p>标签
             */
            formatter: function (value) {
                return "<p>" + this.tickFormat(value) + "</p>";
            },
            /**
             * @var position
             * @extends xCharts.axis
             * @type String
             * @values x轴'top'|'bottom'；y轴'left'|'right'
             * @description
             *  多X多Y轴使用，控制坐标轴位置
             * @default x轴'bottom';y轴'left'
             */
            position: type == 'xAxis' ? 'bottom' : 'left',//left时y轴在左边，right时Y轴在右边,默认为left;top时x轴在顶端，bottom时x轴在底部,默认bottom.
            /**
             * @var maxValue
             * @extends xCharts.axis
             * @type Number
             * @description
             *  当type=value时有效
             *  控制坐标轴上最大值显示
             *  当传入值中的最大值超过maxValue时，以传入值为准
             */
            //maxValue: 100,
            /**
             * @var minValue
             * @extends xCharts.axis
             * @type Number
             * @description
             *  当type=value时有效
             *  控制坐标轴上最小值显示
             *  当传入值中的最小值小于minValue时，以传入值为准
             */
            //minValue: 0, //type=value有效，手动设置最大最小值,
            /**
             * @var show
             * @extends xCharts.axis
             * @type Boolean
             * @default true
             * @description
             * 当不需要显示坐标轴时，可以关掉这个选项
             */
            show: true
        }
        return axis;
    }


}(window))