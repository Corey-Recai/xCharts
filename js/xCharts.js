/**
 * Created by liuyang on 15/10/23.
 */
(function (window) {

    /**
     * 入口，自动调用new init
     * @param container 块级元素 选中的容器,容器需要有宽高
     * @returns {xCharts.init}
     */
    var d3=window.d3;
    var id=1;
    function xCharts(container) {

        if(!d3){
            console.error('The library depends on d3js http://d3js.org/ ')
            return;
        }

        return new xCharts.prototype.init(container);
    }

    xCharts.extend = xCharts.prototype.extend = function (obj) {
        for (var k in obj) {
            if (obj.hasOwnProperty(k))
                this[k] = obj[k];
        }
    }

    xCharts.prototype.extend({
        //初始化方法
        init: function (container) {
            container=d3.select(container);
            container.html('');//清理容器里面的所有节点
            this.container=container;
            this.originalWidth=getWidth(container.node());
            this.originalHeight=getHeight(container.node());
            this.id=id++; //唯一标识，<use> 在多图表使用时，区别其他图用
            this.div=container.append('div').attr('class','xc-container');
            this.svg=this.div.append('svg').attr('class','xc-svg').attr('width',this.originalWidth).attr('height',this.originalHeight);
            this.main=this.svg.append('g').attr('class','xc-main');
            this.margin = {top: 30, left: 50, right: 50, bottom: 30};
            this.originMargin=xCharts.utils.copy(this.margin);//克隆一个副本，提供给refresh重置用
            this.EventList={};
            return this;
        },
        loadConfig: function (config) {
            //加入时间测试
            // console.time("draw charts")
            //深复制config
            this.config=xCharts.utils.copy(config,true);
            this.getColor=xCharts.utils.getColor(config.color);
            this.firstDrawing(this.config);
            // console.timeEnd("draw charts");
        },
        firstDrawing:function(config){
            //可以使用的组件列表,需要修改margin的组件请放在'xAxis','yAxis'前面
            var componentsList=['title','tooltip','legend','animation','xAxis','yAxis','autoRefresh'];
            var component,i= 0;
            this.components={};
            this.charts={};
            while(component=componentsList[i++]){
                if(!config[component] || this.components[component]){
                    continue;
                }
                var componentClass=xCharts.components[component];

                //特殊处理下axis
                if(component=='xAxis' || component=='yAxis'){
                    componentClass=xCharts.components['axis'];
                }

                //容错处理
                if(!componentClass){
                    console.warn('components/%s.js is not loaded!',component.match(/Axis/)?'axis':component);
                    continue;
                }
                this.components[component]=new componentClass(this,config,component);

            }
            //计算折线图之类的charts实际可用空间
            this.width=this.originalWidth-this.margin.left-this.margin.right;
            this.height=this.originalHeight-this.margin.top-this.margin.bottom;
            //mainGroup设置偏移量
            this.main.attr('transform','translate('+this.margin.left+','+this.margin.top+')');
            //调用图表
            config.series||(config.series=[]);
            for(var i= 0,s;s=config.series[i++];){
                var type = s.type;
                if(this.charts[type]){
                    //每个图表类只调用一次
                    continue;
                }
                var chartClass=xCharts.charts[type];


                //容错处理
                if(!chartClass){
                    console.warn('charts/%s.js is not loaded!',type);
                    continue;
                }

                this.charts[type]=new chartClass(this,config);
            }
        },
        refresh:function(){
            console.time("refresh time");
            //刷新产生的条件,预知
            //1 容器大小发生了改变，修正
            this.originalWidth=getWidth(this.container.node());
            this.originalHeight=getHeight(this.container.node());
            this.margin=xCharts.utils.copy(this.originMargin);

            this.svg.attr('width',this.originalWidth).attr('height',this.originalHeight);

            //第二步 通知已有组件刷新
            var components=this.components,charts=this.charts;
            for(var k in components){
                if(components.hasOwnProperty(k)){
                    var component = components[k];
                    component.refresh();
                }
            }

            this.width=this.originalWidth-this.margin.left-this.margin.right;
            this.height=this.originalHeight-this.margin.top-this.margin.bottom;
            //第三步 通知已有图表刷新
            for(var k in charts){
                if(charts.hasOwnProperty(k)){
                    var chart = charts[k];
                    chart.refresh();
                }
            }

            console.timeEnd("refresh time");

        },
        updateSeries:function(series){
            this.config.series=xCharts.utils.copy(series,true);
            this.margin=xCharts.utils.copy(this.originMargin);
            //第一步 通知已有组件刷新
            var components=this.components,charts=this.charts;
            for(var k in components){
                if(components.hasOwnProperty(k)){
                    var component = components[k];
                    component.updateSeries(this.config.series);
                }
            }
            //第二步 通知已有图表刷新
            for(var k in charts){
                if(charts.hasOwnProperty(k)){
                    var chart = charts[k];
                    chart.updateSeries(this.config.series);
                }
            }
        },
        on:function(str,cb){
            //契合D3，一个namespace只会有一个fn，后来的会使上面的fn失效
            //满足先到先响应的策略
            var list=this.EventList;
            var arr=str.split('.');
            var type=arr[0];
            var nameSpace=arr[1]?arr[1]:'default';
            list[type]||( list[type]=[]);
            for(var i= 0,l;l=list[type][i++];){
                if(l.nameSpace==nameSpace){
                    list[type].splice(i-1,1);
                    break;
                }
            }
            list[type].push({nameSpace:nameSpace,callback:cb})
        },
        fire:function(type){
            var args=Array.prototype.slice.call(arguments,1);
            var list=this.EventList[type];
            if(!list) return;
            list.forEach(function(l){
                l.callback.apply('',args);
            })
        }
    })
    xCharts.prototype.init.prototype=xCharts.prototype;
    xCharts.extend({
        //图表库
        charts:{
            extend:xCharts.extend
        },
        //组件库
        components:{
            extend:xCharts.extend
        },
        //工具库
        utils:{
            extend:xCharts.extend
        }
    })


    /**
     * 获取对应的css值
     * @param container 需要计算的元素
     * @param type css名称
     * @param boolean 是否运用parseFloat
     * @returns {*}
     */
    function css(container,type,boolean){
        var style = getComputedStyle(container);
        var value = style[type];

        return boolean?parseFloat(value):value;

    }

    function getWidth(container){
        var width = css(container,'width',true);
        if(css(container,'boxSizing')!=='border-box'){
            return width;
        }
        width = width - css(container,'borderLeftWidth',true)
            - css(container,'paddingLeft',true)
            - css(container,'paddingRight',true)
            - css(container,'borderRightWidth',true);
        return width;
    }
    function getHeight(container){
        var height = css(container,"height",true);
        if(css(container,'boxSizing')!=='border-box'){
            return height;
        }
        height = height - css(container,'borderTopWidth',true)
            - css(container,'paddingTop',true)
            - css(container,'paddingBottom',true)
            - css(container,'borderBottomWidth',true);
        return height;
    }


    window.xCharts = xCharts;
}(window))