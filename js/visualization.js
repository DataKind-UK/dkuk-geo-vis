var COUNT_SCHOOL_DISPLAY = 3;

var centered;

var svg, projection, gmapProjection, path, g, gmap;
var marker_scale, marker_data, activeId, choropleth_data, source_data;
var all_data = {}, activeData = "population_total";
var min_population = 100;
var defaultColor = "#aaa";
var chartSvg, labels, anchors, links, label_array = [], anchor_array = [];
var chartMargin = {top: 30, right: 80, bottom: 10, left: 80};
var chartWidth = 268, chartHeight = 150;
var w = chartWidth - chartMargin.left - chartMargin.right;
var h = chartHeight - chartMargin.top - chartMargin.bottom;
var scale = d3.scale.linear().domain([0, 1]).range([h, 0]);
var ord_scale = d3.scale.ordinal().domain(["Under 18", "Over 18"]).range([0, w]);
var color = d3.scale.category20();
var dotRadius = 4;

var currentMetric = null;
var markerType = "clear";
var highlightedNeighborhood = null;

var gmap_style=[
  {
    "elementType": "labels.text.fill",
    "stylers": [
      { "color": "#000000" }
    ]
  },{
    "featureType": "administrative",
    "elementType": "geometry",
    "stylers": [
      { "visibility": "off" }
    ]
  },{
    "featureType": "poi",
    "stylers": [
      { "visibility": "off" }
    ]
  },{
    "featureType": "landscape.man_made",
    "stylers": [
      { "visibility": "on" },
      { "color": "#ffffff" }
    ]
  },{
    "featureType": "landscape.natural",
    "stylers": [
      { "color": "#ffffff" }
    ]
  },{
    "featureType": "road",
    "elementType": "geometry",
    "stylers": [
      { "color": "#f6f4f3" }
    ]
  },{
    "elementType": "labels.icon",
    "stylers": [
      { "visibility": "off" }
    ]
  },{
    "featureType": "water",
    "elementType": "labels",
    "stylers": [
      { "visibility": "off" }
    ]
  },{
    "featureType": "water",
    "elementType": "geometry",
    "stylers": [
      { "visibility": "on" },
      { "color": "#cfddff" }
    ]
  },{
     "featureType": "administrative.neighborhood",
     "elementType": "labels.text",
     "stylers": [
      { "visibility": "off" }
    ]
  }
];

$(document).ready(function() {
  init();
}); // end document ready function

function init(){
  resizeContainer($("#content").parent().width());
  drawChoropleth();
  //drawChart();

  //====EVENT LISTENERS===//

  // slide out menu
  $(".menu-toggle").on("click", toggleMenu);

  // event listeners for changing d3
  // choropleth color change
  $(".neighborhood-menu > li").on("click", "a", function(e){
    e.preventDefault();
    if (!$(this).parent().hasClass('disabled')){
      currentMetric=(typeof $(this).attr("id")==="undefined")?null:$(this).attr("id");
      getSource(source_data,currentMetric);
      changeNeighborhoodData(currentMetric);
      $(this).parent().addClass("selected").siblings().removeClass("selected");
      $("#legend-panel").show();
      $("#details p.lead").show();
    }
  });

  // marker type changes
  $(".marker-type-menu > li").on("click", "a", function(e){
    e.preventDefault();

    //$(this).parent().addClass("selected").siblings().removeClass("selected");

    var $$parent = $(this).parent();
    if ($$parent.hasClass("selected")) {
      removeMarkers($(this).attr("id"));
    } else {
      drawMarkers($(this).attr("id"));
    }
    $$parent.toggleClass("selected");

  });

//  // circle changes
//  $(".marker-type-menu > li").on("click", "a", function(e){
//    e.preventDefault();
//    var value = $(this).attr("id") === "no_marker_data" ? 4 : "math_perc"; //$(this).attr("id");
//    changeMarkerData(value);
//    $(this).parent().addClass("selected").siblings().removeClass("selected");
//  });

  // narrative
  $("#narrative-row button").click(function() {
    if($(this).hasClass('active'))
      $(this).removeClass('active'); //change with .activatebutton
    else
      $("button.active").removeClass("active");
      $(this).addClass('active');
  });

  $("#narrative a.close-box").click(function (event) {
    event.preventDefault();
    removeNarrative();
  });

  $('#narrative-row button').on('click', function(){
    $( "#narrative" ).fadeIn(400);
    $('#narrative div.panel-body').hide();
    $('#' + $(this).data('rel')).show();
    $('#nav-panel #' + $(this).attr('data-filter')).trigger('click');
  });

  $(window).resize(function(){
    resizeContainer($("#content").parent().width());
  });
}
function resizeContainer(width){
  var new_height = $(window).width() < 797 ? $("#content").parent().width() * 0.75 : 600;
  $("#content").css({"width":width,"height":new_height});
  $("#nav-panel").css({"height": new_height});
}
function transform(d) {
    d = new google.maps.LatLng(d.value[1], d.value[0]);
    d = projection.fromLatLngToDivPixel(d);
    return d3.select(this)
        .style("left", (d.x - 2) + "px")
        .style("top", (d.y - 2) + "px");
}

function drawChoropleth(){

  queue()
    //.defer(d3.json, "data/neighborhoods44.json")
    .defer(d3.json, "data/geodata/leeds_lsoa.geojson")
    .defer(d3.csv, "data/leeds_lsoa_data.csv")
    .defer(d3.csv, "data/source.csv")
    .await(setUpChoropleth);

  function setUpChoropleth(error, dc, choropleth,source) {
    //clean choropleth data for display.
    choropleth_data = choropleth;
    source_data = source;
    choropleth_data.forEach(function(d) {
      all_data[d.gis_id] = d;
      choropleth_data[d.gis_id] = +d.population_total;
    });

    gmap = new google.maps.Map(d3.select("#content").node(), {
      zoom: 12,
      minZoom: 12,
      maxZoom: 14,
      //DC:
      //center: new google.maps.LatLng(38.89555, -77.01551),
      //Leeds, UK:
      center: new google.maps.LatLng(53.806,-1.5357),  
      mapTypeId: google.maps.MapTypeId.ROADMAP,
      streetViewControl: false,
      panControl: false,
      scrollwheel: false
    });

    gmap.setOptions({
      mapTypeControl: false,
      styles: gmap_style
    });

    google.maps.event.addListenerOnce(gmap, "idle", function(){
      // adjust the zoom bar
      $("div[title='Zoom in']").parent().css({"margin-top":"60px"});
    });

    var maxBounds = new google.maps.LatLngBounds(
      //new google.maps.LatLng(38.85,-77.10),
      //new google.maps.LatLng(38.97,-76.82)
      new google.maps.LatLng(53.6,-1.65),
      new google.maps.LatLng(53.9,-1.40)
    );

    // If a drag ends outside of our max bounds, bounce back to the default center.
    google.maps.event.addListener(gmap, "dragend", function() {
      if (maxBounds.contains(gmap.getCenter())) { return; }

     var c = gmap.getCenter(),
         x = c.lng(),
         y = c.lat(),
         maxX = maxBounds.getNorthEast().lng(),
         maxY = maxBounds.getNorthEast().lat(),
         minX = maxBounds.getSouthWest().lng(),
         minY = maxBounds.getSouthWest().lat();

     if (x < minX) x = minX;
     if (x > maxX) x = maxX;
     if (y < minY) y = minY;
     if (y > maxY) y = maxY;

     gmap.panTo(new google.maps.LatLng(y, x));

    });

    var overlay = new google.maps.OverlayView();
    svg = d3.select("#content").append("svg:svg");

    // Add the container when the overlay is added to the map.
    overlay.onAdd = function() {

      var layer = d3.select(this.getPanes().overlayLayer)
      .attr("id","overlay")
      .append("div")
      .attr("id","theDiv");

      var svg = layer.append("svg")
      .attr("id","theSVGLayer");

      g = svg.append("g");
      var neighborhoods = g.append("g").attr("id", "neighborhoods");
      g.append("g").attr("id", "markers");
      d3.select("#legend-container").append("svg")
          .attr("height", 200)
        .append("g")
          .attr("id", "legend");

      overlay.draw = function() {
        var data_values = _.filter(_.map(choropleth_data, function(d){ return parseFloat(d[currentMetric]); }), function(d){ return !isNaN(d); });

        var projection = this.getProjection(),
        padding = 10;

        gmapProjection = function (coordinates) {
          var googleCoordinates = new google.maps.LatLng(coordinates[1], coordinates[0]);
          var pixelCoordinates = projection.fromLatLngToDivPixel(googleCoordinates);
          return [pixelCoordinates.x+4000, pixelCoordinates.y+4000];
        };

        path = d3.geo.path().projection(gmapProjection);

        // Have to remove all the paths and readd them otherwise the visualization was highlighting the old path
        // and the new path when zooming.
        neighborhoods.selectAll("path").remove();
        neighborhoods.selectAll("path")
          .data(dc.features)
          .enter().append("path")
          .attr("d", path)
          .attr("id", function (d) { return "path" + d.properties.NCID; })
          .attr("class", "nbhd")
          .on("mouseover", hoverNeighborhood)
          .on("click", function(d) { highlightNeigborhood(d, false); })
          .style("fill",function(d) {
            if (currentMetric === null || all_data[d.properties.gis_id][currentMetric] === '0') { return defaultColor; }
            else { return choro_color(all_data[d.properties.gis_id][currentMetric]); }
          })
          .style("fill-opacity",0.75);

        g.select("#markers").selectAll("circle").remove();

        //if there is a highlighted neighborhood then rehighlightit.
        if(highlightedNeighborhood) {
          highlightNeigborhood(highlightedNeighborhood, true);
        }

        redrawMarkers();
      };
    };

    // Bind our overlay to the map…
    overlay.setMap(gmap);

  } // setUpChoropleth function

} // drawChoropleth function

function changeNeighborhoodData(new_data_column) {
  var data_values = _.filter(_.map(choropleth_data, function(d){ return parseFloat(d[new_data_column]); }), function(d){ return !isNaN(d); });
  var jenks = _.filter(_.unique(ss.jenks(data_values, 5)), function(d){ return !isNaN(d); });

  var color_palette = [ "#9ae3ff", "#45ccff", "#00adef", "#00709a", "#003245"];

  // trim lighter colours from palette (if necessary)
  color_palette = color_palette.slice(6 - jenks.length);

  activeData = new_data_column;
  choro_color = d3.scale.threshold()
    .domain(jenks.slice(1,-1))
    .range(color_palette);
  choropleth_data.forEach(function(d) {
    choropleth_data[d.gis_id] = +d[new_data_column];
  });

  g.select("#neighborhoods").selectAll("path")
    .transition().duration(600)
    .style("fill", function(d) {
      if(typeof all_data[d.properties.gis_id] ==="undefined" ||
        all_data[d.properties.gis_id].population_total < min_population ||
        !all_data[d.properties.gis_id][new_data_column] ||
        all_data[d.properties.gis_id][currentMetric] === '0'){
        return defaultColor;
      } else {
        return choro_color(all_data[d.properties.gis_id][new_data_column]);
      }
    })
    .style("fill-opacity",0.75);

  if(activeId && new_data_column !== "no_neighborhood_data") {
    setVisMetric(new_data_column, all_data[activeId][new_data_column]);
  } else {
    setVisMetric(null, null, true);
    removeMarkers("clear");
    $(".selected").removeClass("selected");
    $("#details p.lead").hide();
    $("#legend-panel").hide();
  }

  var zeroElement = jenks[0] === 0 && jenks[1] === 1;

  var previousElement = function(n, a){
    return _.max(_.filter(a, function(d){ return d < n; } ));
  };

  var legendText = function(d, jenks){
    if(d == _.min(jenks)) {
      if (zeroElement) { return "0"; }
      return "Less than " + legendNumber(d);
    } else if(d > _.max(jenks)){
      return legendNumber(_.max(jenks)) + " and above";
    } else {
      return legendNumber(previousElement(d, jenks)) + " - " + legendNumber(d);
    }
  };

  var legendNumber = function(d, typeDef){
    var column = String([new_data_column]);
    var number_formatter = d3.format(",");
    if (column.split("_").pop() == 'perc'){
      return parseInt(d * 100, 10) + "%";
    } else if(column.split("_").pop() == 'val'){
      num = Math.round(d);
      return number_formatter(parseInt(d, 10));
    } else if(column.split("_").pop() == 'cur'){
      return "$" + number_formatter(parseInt(d, 10));
    } else if(column.split("_").pop() == 'ratio'){
      num = Math.round(d * 100)/100;
      return num;
    } else {
      return d;
    }

  };

  var updatedLegend = d3.select("#legend").selectAll(".legend")
      .data(jenks.slice(1).reverse());

  enterLegend = updatedLegend.enter().append("g")
    .attr("transform", function(d, i){ return "translate(0," + (i * 35) + ")"; })
    .attr("class", "legend");

  enterLegend.append("rect")
    .attr("width", 170)
    .attr("height", 30)
    .style("opacity", "0.75");

  enterLegend.append("text")
    .style("fill", "black")
    .attr("dy",20)
    .attr("dx", 85)
    .attr("font-size", "13px")
    .attr("text-anchor", "middle");

  updatedLegend.select("text")
    .text(function(d){ return legendText(d, jenks.slice(1,-1));});

  updatedLegend.select("rect")
    .style("fill", function(d, i) {
      if (zeroElement && jenks.length - i === 2) { return defaultColor; };
      return color_palette[color_palette.length - i - 1];
    });

  updatedLegend.exit().remove();

}

function redrawMarkers() {
  if($("#public").parent().hasClass("selected")) {
    drawMarkers("public");
  }

  if($("#jobcentres").parent().hasClass("selected")) {
    drawMarkers("jobcentres");
  }
}

function drawMarkers(type){
  markerType=type;

  var packer = sm.packer(),
      file = "",
      prop, color;

  //this could be cleaned up if we use a consistent naming convention.
  switch(type) {
    case "jobcentres":
      file = "data/jobcentres.json";
      prop = "jobcentres";
      size_prop = "math_perc";
      break;
    case "mentalHealthOrgs":
      file = "data/mentalHealthOrgs.json";
      prop = "mentalHealthOrgs";
      size_prop = "";
      break;
    case "highStBanks":
      file = "data/highStBanks.json";
      prop = "highStBanks";
      size_prop = "";
      break;
    case "subprimeLenders":
      file = "data/subprimeLenders.json";
      prop = "subprimeLenders";
      size_prop = "";
      break;
  }

    //switched this to read json.
    d3.json(file, function(data){
    if(type === "clear") {
      prop = "clear";
      data = {
        "clear": []
      };
    }
    marker_data = data[prop];
    marker_scale = d3.scale.sqrt().range([4,15]);        
    var circle = g.select("#markers").selectAll("circle").data(data[prop], function(d) {
      return d.name;
    });
    var circleEnter = circle.enter().append("circle")
    .attr("class", "marker " + type)
    .attr("r", 4)
    .attr("transform", function(d) {
      return "translate(" + gmapProjection([d.long, d.lat]) + ")";})
    .append("title").text(function(d){return d.name;});

    circle.on("click", displayMarkerData);
    packMetros();

    if (size_prop!=="") {
    changeMarkerData(size_prop);
    }

    function displayMarkerData(marker) {
      var $markers = $("#markers_panel");
      var $panelBody = $markers.find(".panel-body");
      var $markerData = $panelBody.children(".marker-data");

      //Don"t add the marker twice.
      for (var i = 0, len = $markerData.length; i < len; i++) {
          if(marker.name === $($markerData[i]).find(".marker-name").text()) { return; }
      }

      //Show panel on first marker click.
      if ($markers.hasClass("hide")) {
        $("#btnPanelClose").on("click", closePanel);
        $markers.toggleClass("hide");
      }

      //Limit number of displayed markers.
      if ($markerData.length === COUNT_SCHOOL_DISPLAY) {
        $panelBody.children(":nth-child(" + COUNT_SCHOOL_DISPLAY + ")").remove();
      }

      //Add a new marker to the display.
      var $markerDisplay = $panelBody.find("#marker_data").clone();
      $panelBody.prepend(buildNewMarker($markerDisplay, marker));
    }

    function buildNewMarker($markerDisplay, marker) {
      $markerDisplay.removeAttr("id").removeAttr("class").addClass("marker-data");

      var $markerName = $markerDisplay.find(".marker-name");
      $markerName.html(marker.name);
      $markerName.on("click", function() {
        $markerDisplay.remove();
        setPanel();
      });
      $markerDisplay.find(".marker-service").html(getDisplayValue(marker.primary_service, "primary_service", "val"));
      $markerDisplay.find(".marker-building").html(getDisplayValue(marker.building, "building", "val"));
      $markerDisplay.find(".marker-address").html(getDisplayValue(marker.address, "address", "val"));
      return $markerDisplay;
    }

    // Close button click handler.
    function closePanel(event) {
      event.preventDefault();
      $("#btnPanelClose").off("click", closePanel);
      $(".marker-data").remove();
      $("#markers_panel").addClass("hide");
    }

    function setPanel() {
      var $markers = $("#markers_panel");
      var $panelBody = $markers.find(".panel-body");
      if ($panelBody.children(".marker-data").length === 0) {
        $markers.addClass("hide");
      }
    }
  });

  function packMetros() {
    var elements = d3.selectAll("#markers circle")[0];
    packer.elements(elements).start();
  }
}

function removeMarkers(type) {
  if (type == "clear") {
    g.select("#markers").selectAll("circle").remove();
  } else {
    g.select("#markers").selectAll("circle." + type).remove();
  }
}


function changeMarkerData(new_data_column) {
  if (typeof new_data_column === "string"){
    matchScaleToData(marker_scale, function(d){return +d[new_data_column];});
  }
  g.select("#markers").selectAll("circle")
    .transition().duration(600)
    .attr("r", function(d) {
      return typeof new_data_column !== "string" ? 4 : marker_scale(d[new_data_column]);
    });
}

function matchScaleToData(scale, fieldFunction) {
  var minimum = d3.min(marker_data, fieldFunction),
      maximum = d3.max(marker_data, fieldFunction);
  scale.domain([minimum, maximum]);
}

function drawChart(){
  chartSvg = d3.select(".chart").append("svg").attr("width",chartWidth).attr("height",chartHeight)
    .append("g")
    .attr("transform","translate(" + chartMargin.left + "," + chartMargin.top + ")");

  var left_axis = d3.svg.axis().scale(scale).tickFormat("").orient("right").ticks(5);
  var right_axis = d3.svg.axis().scale(scale).tickFormat("").orient("left").ticks(5);

  chartSvg.append("g").attr("class","axis").call(left_axis)
    .append("text").text("Under 18").attr("text-anchor","middle").attr("x",0).attr("y",-10);

  chartSvg.append("g").attr("class","axis").attr("transform","translate(" + w + ",0)").call(right_axis)
    .append("text").text("Over 18").attr("class","axisTitle").attr("text-anchor","middle").attr("x",0).attr("y",-10);

  var ethdata = [
    {name: "white", under18: 0.23, over18: 0.32},
    {name: "black", under18: 0.60, over18: 0.55},
    {name: "hispanic", under18: 0.10, over18: 0.06},
    {name: "other", under18: 0.07, over18: 0.05}
  ];

  var ethnicity = chartSvg.selectAll(".ethnicity")
      .data(ethdata)
    .enter().append("g")
      .attr("class","ethnicity");

  ethnicity.append("line")
    .attr("x1", function(d) { return ord_scale("under18"); })
    .attr("x2", function(d) { return ord_scale("over18"); })
    .attr("y1", function(d) { return scale(d.under18); })
    .attr("y2", function(d) { return scale(d.over18); })
    .style("stroke",function(d){ return color(d.name); })
    .style("stroke-width",2);

  drawLabels(ethdata);

  var sim_ann = d3.labeler()
    .label(label_array)
    .anchor(anchor_array)
    .width(w)
    .height(h);
    sim_ann.start(1000);

  redrawLabels();
}

function updateChart(data){
  var ethdata = [
    {name: "white", under18: data.pop_nothisp_white_under18_perc, over18: data.pop_nothisp_white_perc},
    {name: "black", under18: data.pop_nothisp_black_under18_perc, over18: data.pop_nothisp_black_perc},
    {name: "hispanic", under18: data.pop_hisp_under18_perc, over18: data.pop_hisp_perc},
    {name: "other", under18: data.pop_nothisp_other_under18_perc, over18: data.pop_nothisp_other_perc}
  ];

  chartSvg.selectAll(".ethnicity line")
    .data(ethdata)
    .transition()
    .duration(500)
    .attr("y1", function(d) { return scale(d.under18); })
    .attr("y2", function(d) { return scale(d.over18); });

  drawLabels(ethdata);

  var sim_ann = d3.labeler()
    .label(label_array)
    .anchor(anchor_array)
    .width(w)
    .height(h);
    sim_ann.start(1000);

  redrawLabels();
}

function drawLabels(data){
  label_array = [];
  anchor_array = [];
  var label, anchor;
  for(i=0; i<4; i++){
    label = {
     x: ord_scale("under18"),
     y: scale(data[i].under18),
     width: 0.0,
     height: 0.0,
      name: Math.round(data[i].under18*100) + "% " + data[i].name,
      ethnicity: data[i].name, agegroup: "under18"};
    label_array.push(label);

    label = {
     x: ord_scale("over18"),
     y: scale(data[i].over18),
     width: 0.0,
     height: 0.0,
      name: Math.round(data[i].over18*100) + "% " + data[i].name,
      ethnicity: data[i].name, agegroup: "over18"};
    label_array.push(label);

    anchor = {x: ord_scale("under18"), y: scale(data[i].under18), r: 4, ethnicity: data[i].name};
    anchor_array.push(anchor);

    anchor = {x: ord_scale("over18"), y: scale(data[i].over18), r: 4, ethnicity: data[i].name};
    anchor_array.push(anchor);
  }

  chartSvg.selectAll(".dot").data([]).exit().remove();
  chartSvg.selectAll(".label").data([]).exit().remove();
  chartSvg.selectAll(".link").data([]).exit().remove();

  labels = chartSvg.selectAll(".label")
    .data(label_array).enter()
    .append("text")
    .attr("class", "label")
    .attr("text-anchor", function(d) {
      if(d.agegroup == "under18") return "end";
      else return "start"; })
    .attr("alignment-baseline","central")
    .text(function(d) { return d.name; })
    .attr("x", function(d) {
     if(d.agegroup == "under18") return d.x - 10;
     else return d.x + 10; })
    .attr("y", function(d) { return (d.y); })
    .attr("fill", function(d) { return color(d.ethnicity); });

  var index = 0;
  labels.each(function() {
    label_array[index].width = this.getBBox().width;
    label_array[index].height = this.getBBox().height;
    index += 1;
  });

  links = chartSvg.selectAll(".link")
    .data(label_array).enter()
    .append("line")
    .attr("class", "link")
    .attr("x1", function(d) { return (d.x); })
    .attr("y1", function(d) { return (d.y); })
    .attr("x2", function(d) {
     if(d.agegroup =="under18") return d.x - 10;
     else return d.x + 10; })
    .attr("y2", function(d) { return (d.y); });

  anchors = chartSvg.selectAll(".dot")
    .data(anchor_array)
    .enter().append("circle")
    .attr("class", "dot")
    .attr("r", function(d) { return (d.r); })
    .attr("cx", function(d) { return (d.x); })
    .attr("cy", function(d) { return (d.y); })
    .style("fill", function(d) { return color(d.ethnicity); });
}

function redrawLabels() {
  labels
  .transition()
  .duration(500)
  //.attr("x", function(d) { return (d.x); })
  .attr("y", function(d) { return (d.y); });

  links
  .transition()
  .duration(500)
  //.attr("x2",function(d) { return (d.x); })
  .attr("y2",function(d) { return (d.y); });
}

function toggleMenu() {
  var $this = $(".menu-toggle");
  if ($this.parent().hasClass("toggled")){
    $this.parent().animate({ "left" : 0 }, 350, function(){ $("#main-container").removeClass("toggled"); });
  } else {
    $this.parent().animate({ "left" : $("#nav-panel").width() }, 350, function(){ $("#main-container").addClass("toggled"); });
    removeNarrative();
  }
}

function displayPopBox(d) {
  //clear the menu if it"s exposed.
  if($("#main-container")[0].classList.contains("toggled")) {
    toggleMenu();
  }

  var $popbox = $("#pop-info"),
      highlighted = all_data[d.properties.gis_id];

  d3.select(".neighborhood").html(highlighted.lsoa_name);

  var val, key, typeDef;
  $.each($popbox.find("tr"), function(k, row){
    key = $(row).attr("data-type");
    val = highlighted[key];
    typeDef = key.slice(key.lastIndexOf("_") + 1);
    $(row).find(".count").html(getDisplayValue(val, key, typeDef));
  });
}


function highlightNeigborhood(d, isOverlayDraw) {
  // click and zoom map to nbhd bounds
  // var polyBounds = new google.maps.Polygon({
  // paths: formatLatLng(d.geometry.coordinates[0])
  // }).getBounds();
  // gmap.fitBounds(polyBounds);
  removeNarrative();
  highlightedNeighborhood = d;
  var x, y, k;

  if (d && centered !== d) {
    var centroid = path.centroid(d);
    x = centroid[0];
    y = centroid[1];
    k = 4;
    centered = d;
  } else {
    x = $('#content').width() / 2;
    y = $('#content').height() / 2;
    k = 1;
    centered = null;
  }

  // if this is being called from the overlay.draw handler then
  // select the centered neighborhood and bring it to the front.
  if(!isOverlayDraw) {
    g.selectAll("path")
      .classed("active", centered && function(d) { return d === centered; });

    // if d is a neighborhood boundary and clicked
    if (d && all_data[d.properties.gis_id]){
      displayPopBox(d);
      //last neighborhood to display in popBox.
      activeId = d.properties.gis_id;
      setVisMetric(activeData, all_data[activeId][activeData]);
      //updateChart(all_data[activeId]);
    }
  } else {
    g.selectAll("#path" + highlightedNeighborhood.properties.NCID).classed("active", true);
    bringNeighborhoodToFront();
  }
}

function bringNeighborhoodToFront() {
  if (centered) {
      var activeNeighborhood = d3.select(".active");
      activeNeighborhood.each(function () {
        this.parentNode.appendChild(this);
      });
      return;
    }
}

function hoverNeighborhood(d) {
  // keep active path as the displayed path.
  if($("path.active").length > 0) {
    // keep centered neighborhood path up front
    bringNeighborhoodToFront();
    return;
  }

  //bring hovered neighborhood path to front.
  var neighborhood = d3.select(d3.event.target);
  neighborhood.each(function () {
    this.parentNode.appendChild(this);
  });

  //but also keep centered neighborhood path up front
  bringNeighborhoodToFront();

  if (d && all_data[d.properties.gis_id]){
    displayPopBox(d);
    //last neighborhood to display in popBox.
    activeId = d.properties.gis_id;

    if (activeData !== "no_neighborhood_data") {
      setVisMetric(activeData, all_data[activeId][activeData]);
      //updateChart(all_data[activeId]);
    } else {
      setVisMetric(null, null, true);
    }

  }
}


//strNum = The Value for the metric.
//name = The Display Name.
//typeDef = The type of value (perc = percentage, val = a number, cur = a dollar amount)
function getDisplayValue(strNum, name, typeDef) {
  var num = parseFloat(strNum);
  var number_formatter = d3.format(",");

  if (isNaN(num)) { return strNum; }

  name = name.toLowerCase();

  switch(typeDef) {
    case "perc":
      return parseInt(num * 100, 10) + "%";
    case "val":
      num = Math.round(num);
      return number_formatter(parseInt(num, 10));
    case "cur":
      return "$" + number_formatter(parseInt(num, 10));
    case "ratio":
      num = Math.round(num * 100)/100;
      return num;
  }

  // just return the number if we can't figure out what type of value it is.
  num = Math.round(num);
  return number_formatter(parseInt(num, 10));

}

function setVisMetric(metric, val, clear) {
  var $metric = $("#visualized-metric");
  var $metricDesc = $("#visualized-measure");

  if (clear) {
    $metric.text("");
    $metricDesc.text("");
    return;
  }

  var $metricType = $("a#" + metric);
  if($metricType.length > 0) {
    var metricText = $metricType.text();
    var typeDef = $metricType[0].id;
    typeDef = typeDef.slice(typeDef.lastIndexOf("_") + 1);
    $metric.text(metricText);
    var newDesc = val === "" ? "N/A" : getDisplayValue(val, metricText, typeDef);
    $metricDesc.text(newDesc);
  }
}

function formatLatLng(coords){
  var gcoords = [];
  $.each(coords, function(i, ll){
    gcoords.push(new google.maps.LatLng(ll[1], ll[0]));
  });
  return gcoords;
}
// getBounds for polyline and polygon doesn"t exist in v3
// this adds method.
if (!google.maps.Polyline.prototype.getBounds){
  google.maps.Polyline.prototype.getBounds = function() {
    var bounds = new google.maps.LatLngBounds();
    this.getPath().forEach( function(latlng) { bounds.extend(latlng); } );
    return bounds;
  };
}

if (!google.maps.Polygon.prototype.getBounds) {
  google.maps.Polygon.prototype.getBounds=function(){
      var bounds = new google.maps.LatLngBounds();
      this.getPath().forEach(function(element,index){bounds.extend(element); });
      return bounds;
  };
}

function getSource(data, layerID){
  if(layerID == "no_neighborhood_data"){
    d3.select("#source-title").text("").attr("href",null);
  }
  data.forEach(function(d){
    if(d.layer == layerID){
      d3.select("#source-title")
        .text(d.source)
        .attr("href",d.url);
      $("#source").show();
      return false;
    }
  });
}

function removeNarrative() {
  $( "#narrative" ).fadeOut(400);
  $( "#narrative-row button" ).removeClass('active');
}
