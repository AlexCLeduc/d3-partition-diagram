import React from "react";
import { sum } from "d3-array";
import { color } from "d3-color";
import { scaleLinear } from "d3-scale";
import { select } from "d3-selection";
import "d3-transition";
import _ from "lodash";

import { PartitionDataWrapper } from "./PartitionDataWrapper.js";

/* eslint import/no-webpack-loader-syntax: off */
// eslint-disable-next-line import/no-unresolved
import _styles from "./PartitionDiagram.css";
import { ReactContentRenderer } from "./util";

// TODO: consider IE implications
const is_IE = _.constant(false);

//TODO: taken from IB, extract to util
export const text_abbrev = function (text, length) {
  const length_value = _.isFunction(length) ? length() : length || 60;

  return text.length > length_value
    ? text.substring(0, length_value - 4) + "..."
    : text;
};

const assign_colors_recursively = function (node, color) {
  node.color = color;
  if (_.isUndefined(node.children)) {
    return;
  }
  _.each(node.children, (child, i) => {
    assign_colors_recursively(child, color.brighter(0.15));
  });
};
const content_key = d => d.id_ancestry;
const polygon_key = d => d.target.id_ancestry;

export class BasePartitionDiagram {
  constructor(container, options) {
    this.options = options;
    this.outer_html = container;
    this.outer_html.html(`
      <div class='partition-diagram-outer-area' aria-hidden='true'>
         <div class='partition-diagram'></div>
      </div>
    `);
    this.html = this.outer_html.select(".partition-diagram");

    this.svg = this.html.append("div").classed("__svg__", true).append("svg");

    this.defs = this.svg.append("defs");

    this.graph_area = this.svg.append("g").attr("class", "graph_area");

    this.html
      .style("position", "relative")
      .style("zoom", 0.4)
      .on("keydown", this.keydown_dispatch)
      .on("click", this.click_dispatch)
      .transition()
      .duration(500)
      .style("zoom", 1)
      .on("end", this.configure_then_render);
  }
  configure_then_render = (options = {}) => {
    this.options = _.extend(this.options, options);

    this.data = new PartitionDataWrapper(
      this.options.data,
      this.options.data_wrapper_node_rules
    );

    this.colors = this.options.colors;
    this.background_color = this.options.background_color;
    this.html.style("background-color", this.background_color);

    this.dont_fade = this.options.dont_fade || [];

    this.level_headers = this.options.level_headers || false;

    this.formatter = this.options.formatter || _.identity;
    this.root_text_func = this.options.root_text_func || _.identity;
    const default_html_func = d => {
      const should_add_value =
        Math.abs(d.value) / this.data.root.value > 0.02 &&
        _.isUndefined(d.data.hidden_children);
      let name;
      if (should_add_value && d !== this.data.root) {
        name = d.data.name + this.formatter(d);
      } else if (!should_add_value && d !== this.data.root) {
        name = text_abbrev(d.data.name, 80);
      } else if (d === this.data.root) {
        name = this.root_text_func(this.data.root.value);
      }
      return name;
    };

    this.options.html_func = this.options.html_func || default_html_func;

    this.render();
  };
  render() {
    if (this.pop_up) {
      this.pop_up = false;
    }

    this.links = this.data.links();
    const levels = this.data.to_open_levels();
    const height = this.options.height;

    const side_padding = (this.side_padding = 50);
    const horizontal0_padding = 50;
    const horizontal_padding = 150;
    const col0_width = 250;
    const col_width = 350;

    const total_width = (this.total_width =
      (_.keys(levels).length - 1) * col_width +
      (_.keys(levels).length - 2) * horizontal_padding +
      col0_width +
      horizontal0_padding +
      side_padding);

    const yscale = scaleLinear()
      .domain([0, this.data.root.value])
      .range([0, height]);

    const cycle_colors = i => {
      return color(this.colors[i % this.colors.length]);
    };

    _.each(this.data.root.children, (node, i) => {
      assign_colors_recursively(node, cycle_colors(i));
    });

    this.outer_html
      .select(".partition-diagram-outer-area")
      .style("width", total_width + "px");

    this.svg.attr("width", total_width);

    const vertical_placement_counters = _.chain(levels)
      .keys()
      .map(key => [key, +key * 30])
      .fromPairs()
      .value();

    const horizontal_placement_counters = _.mapValues(levels, (vals, key) => {
      return (
        side_padding / 2 +
        (+key === 0
          ? 0
          : col0_width +
            horizontal0_padding +
            (key - 1) * (col_width + horizontal_padding))
      );
    });

    this.html.selectAll("div.header").remove();

    if (this.level_headers) {
      this.html
        .selectAll("div.header")
        .data(_.keys(levels).sort().reverse())
        .enter()
        .filter(d => d !== "0")
        .append("div")
        .classed("header", true)
        .style("left", (d, i) => horizontal_placement_counters[+d] + "px")
        .style("width", col_width + "px")
        .html(d => {
          return _.has(this.level_headers, d) ? this.level_headers[d] : "";
        });
    }

    const html_func = this.options.html_func;

    const html_content_join = this.html
      .selectAll("div.partition-item")
      .data(
        this.data.root.descendants().filter(d => d.open),
        content_key
      )
      .style("height", "")
      .each(function (d) {
        select(this)
          .select("div.partition-item__title")
          .classed("right", d.data.type === "compressed")
          .html(html_func);
      }); //reset the calculated heights
    html_content_join.exit().remove();

    const html_content_join_enter = html_content_join
      .enter()
      .append("div")
      .each(function (d) {
        let sel = select(this);

        if ((d.data.type === "compressed" && is_IE()) || d.value < 0) {
          // partition-item__right-ie-fix: IE css for flex box and align-item are inconsistent, need an extra div
          // between the .content div and the .partition-item__title div to (partially) fix vertical alignment

          // partition-item__negative-title-backing: Used in blanking out the striped negative value background, improves readability
          sel = sel
            .append("div")
            .classed("partition-item__negative-title-backing", d.value < 0)
            .classed(
              "partition-item__right-ie-fix",
              d.data.type === "compressed" && is_IE()
            );
        }

        sel
          .append("div")
          .attr("tabindex", 0)
          .classed("partition-item__title", true)
          .classed("right", d.data.type === "compressed")
          .style("background-color", this.background_color)
          .html(html_func);
      })
      .attr("class", d => {
        let cls = "partition-item";
        if (d === this.data.root) {
          cls += " root";
        }
        return cls;
      })
      .style("border-bottom", "")
      .style("top", d => {
        if (_.isNull(d.parent)) {
          return "0px";
        }
        const index = d.parent.children.indexOf(d);

        if (index === 0) {
          return d.parent.top + "px";
        } else {
          return (
            d.parent.children[index - 0].top +
            d.parent.children[index - 0].rendered_height +
            "px"
          );
        }
      })
      .style("width", d => {
        d.width = d === this.data.root ? col0_width : col_width;
        return d.width + "px";
      });

    html_content_join_enter
      .merge(html_content_join)
      .each(function (d) {
        d.DOM = this;
        d.scaled_height = yscale(Math.abs(d.value) || 1);
        d.polygon_links = new Map();
      })
      .classed("partition-item--negative_value", d => d.value < 0)
      .style("left", (d, i) => horizontal_placement_counters[d.depth] + "px")
      .style("height", d => {
        d.rendered_height = Math.floor(d.scaled_height) + 1;
        return d.rendered_height + "px";
      })
      .each(d => {
        const item_node = select(d.DOM);
        const title = item_node.select(".partition-item__title").node();

        const text_is_bigger_then_item =
          title.offsetHeight > d.scaled_height + 2;
        item_node.classed(
          "partition-item--overflowing",
          text_is_bigger_then_item
        );

        item_node
          .select(".partition-item__title")
          .style(
            "background-color",
            text_is_bigger_then_item ? this.background_color : null
          );

        item_node
          .select(".partition-item__negative-title-backing")
          .style(
            "background-color",
            text_is_bigger_then_item ? null : this.background_color
          );

        // IE fixes, a bit hacky but that's how it is:
        const font_size = 12;
        item_node
          .select(".partition-item__right-ie-fix")
          .style("margin-top", function (d) {
            // use margin-top to fix vertical placement of +/-
            const content_height = this.parentElement.style.pixelHeight;
            if (text_is_bigger_then_item && content_height - font_size < 0) {
              return content_height - font_size - 4 + "px";
            } else {
              return "0px";
            }
          })
          .style("padding-top", function (d) {
            // use padding-top to fix vertical placement of +/-
            const content_height = this.parentElement.style.pixelHeight;
            if (!text_is_bigger_then_item) {
              return content_height * 0.5 - font_size * 0.75 + "px";
            } else {
              return "0px";
            }
          });
      })
      .style("background-color", d => {
        return d.color;
      })
      .each(function (d) {
        const level = d.depth;
        const title = select(d.DOM).select(".partition-item__title").node();
        const current_top = vertical_placement_counters[level];
        const parent_top = d.parent ? d.parent.top : 0;
        const diff = (title.offsetHeight - d.DOM.offsetHeight) / 2;
        let top_vertical_margin;
        if (d.parent && _.head(d.parent.children) !== d) {
          top_vertical_margin = 10;
        } else {
          top_vertical_margin = 25;
        }
        if (diff > 0 && diff > 0.5 * top_vertical_margin) {
          top_vertical_margin += diff;
        }
        const top = Math.max(parent_top, current_top);
        const height = Math.max(
          d.rendered_height,
          d.DOM.offsetHeight,
          title.offsetHeight
        );
        vertical_placement_counters[level] = top + height + top_vertical_margin;
        d.top = top + top_vertical_margin;
      })
      .order();

    const total_height = _.max(_.values(vertical_placement_counters)) * 1.01;
    this.html.style("height", total_height + "px");
    this.svg.attr("height", total_height);

    const link_polygons = this.graph_area
      .selectAll("polygon.partition-svg-link")
      .data(
        _.filter(this.links, link => {
          return (
            link.source.open &&
            link.target.open &&
            !link.target.data.unhidden_children
          );
        }),
        polygon_key
      );

    link_polygons.exit().remove();

    link_polygons
      .enter()
      .append("polygon")
      .classed("partition-svg-link", true)
      .merge(link_polygons)
      .each(function (d) {
        d.source.polygon_links.set(d.target, select(this));
      });

    this.html
      .selectAll("div.partition-item")
      .transition()
      .duration(1000)
      .style("top", function (d) {
        return d.top + "px";
      })
      .on("start", d => {
        if (d.children) {
          d.height_of_all_children = sum(
            d.children,
            child => child.scaled_height || 0
          );
        }
        if (d.parent && !d.data.unhidden_children) {
          this.add_polygons(d);
        }
      });

    if (this.dont_fade.length > 0) {
      this.fade();
    }

    if (!_.isUndefined(this.unmagnify_all_popup)) {
      this.remove_unmagnify_all_button();
    }
    if (this.are_any_children_magnified()) {
      this.add_unmagnify_all_button();
    }
  }

  add_polygons(target) {
    const source = target.parent;
    if (
      target ===
      source.children.filter(
        c => _.isUndefined(c.no_polygon) || !c.no_polygon
      )[0]
    ) {
      // (re)set vertical counter to source.top if drawing first polygon for this source
      source.vertical_counter = source.top;
    }
    if (!target.open || !source.open) {
      return;
    }
    const target_x = target.DOM.offsetLeft;
    const target_y = target.top;
    const target_height = target.rendered_height;
    const source_x = source.DOM.offsetLeft + source.width;
    const source_height =
      (source.rendered_height * target.scaled_height) /
      source.height_of_all_children;
    const left_side_padding = this.side_padding / 2;
    let tr, tl, br, bl, klass;
    tr = [target_x, target_y];
    tl = [source_x, source.vertical_counter];
    br = [target_x, target_y + target_height];
    bl = [source_x, tl[1] + source_height];

    klass =
      bl[1] - tl[1] <= 1 ? "tiny" : bl[1] - tl[1] < 5 ? "medium" : "large";

    const gradient_def_id =
      target.color.toString().replace(/\(|\)|, /g, "-") + "grad";
    if (!this.defs.select("#" + gradient_def_id).node()) {
      const gradient_def = this.defs
        .append("linearGradient")
        .attr("id", gradient_def_id);

      gradient_def
        .append("stop")
        .attr("offset", "5%")
        .attr("stop-color", target.color)
        .attr("stop-opacity", "0.3");

      gradient_def
        .append("stop")
        .attr("offset", "95%")
        .attr("stop-color", target.color);
    }

    source.polygon_links
      .get(target)
      .classed(klass, true)
      .classed("root-polygon", d => d.source.parent === null)
      .style("fill", target.color)
      .attr("points", function (d) {
        if (select(this).attr("points")) {
          return select(this).attr("points");
        } else if (d.source.parent === null) {
          return `${tl} ${bl} ${[bl[0], bl[1] + 0.1]} ${[
            left_side_padding,
            bl[1] + 0.1,
          ]} ${[left_side_padding, tl[1] - 0.1]} ${[tl[0], tl[1] - 0.1]}`;
        } else {
          return `${tl} ${bl} ${bl} ${tl}`;
        }
      })
      .transition()
      .duration(1000)
      .attr("points", function (d) {
        if (d.source.parent === null) {
          return `${tr} ${br} ${[bl[0], bl[1] + 0.1]} ${[
            left_side_padding,
            bl[1] + 0.1,
          ]} ${[left_side_padding, tl[1] - 0.1]} ${[tl[0], tl[1] - 0.1]}`;
        } else {
          return `${tr} ${br} ${bl} ${tl}`;
        }
      })
      .attr("stroke", "url(#" + gradient_def_id + ")");

    source.vertical_counter += source_height;
  }

  fade(data) {
    const to_fade = _.filter(
      data || this.data.root.descendants(),
      d => !_.includes(this.dont_fade, d)
    );
    this.svg
      .selectAll("polygon.partition-svg-link")
      .filter(d => _.includes(to_fade, d.target))
      .classed("faded", true)
      .classed("highlighted", false);
    this.html
      .selectAll("div.partition-item")
      .filter(d => _.includes(to_fade, d))
      .classed("faded", true);
  }

  unfade(data) {
    if (this.dont_fade.length > 0) {
      data = data || this.dont_fade;
    } else {
      data = data || this.data.root.descendants();
    }
    const links = _.chain(data)
      .filter(source => _.isArray(source.children))
      .map(source => _.map(source.children, target => ({ source, target })))
      .flatten(true)
      .value();
    this.graph_area
      .selectAll("polygon.partition-svg-link")
      .data(links, polygon_key)
      .filter(d => (links.length > 0 ? _.includes(links, d) : true))
      .classed("faded", false)
      .classed("highlighted", false);

    // The above doesn't select root polygons. If the data contains root, unfade root polygons here
    if (_.some(data, d => d.parent === null)) {
      this.graph_area
        .selectAll("polygon.partition-svg-link.root-polygon")
        .classed("faded", false)
        .classed("highlighted", false);
    }

    this.html
      .selectAll("div.partition-item")
      .data(data, content_key)
      .filter(d => (data.length > 0 ? _.includes(data, d) : true))
      .classed("faded", false);
  }

  // Same as unfade, but more discerning of polygons selected
  unfade_popup_parents(data) {
    if (this.dont_fade.length > 0) {
      data = data || this.dont_fade;
    } else {
      data = data || this.data.root.descendants();
    }
    const lowest_node_id_ancestry = data[0].id_ancestry;
    const links = _.chain(data)
      .filter(source => _.isArray(source.children))
      .map(source => _.map(source.children, target => ({ source, target })))
      .flatten(true)
      .filter(link => {
        const split_and_reverse_id_ancestry = id_ancestry =>
          _.reverse(_.split(id_ancestry, "-"));

        const lowest_node_id_ancestry_chunks = split_and_reverse_id_ancestry(
          lowest_node_id_ancestry
        );
        const link_target_id_ancestry_chunks = split_and_reverse_id_ancestry(
          link.target.id_ancestry
        );

        const longer_of_the_id_chunks =
          lowest_node_id_ancestry_chunks.length >=
          link_target_id_ancestry_chunks.length
            ? lowest_node_id_ancestry_chunks
            : link_target_id_ancestry_chunks;
        const shorter_of_the_id_chunks =
          lowest_node_id_ancestry_chunks.length >=
          link_target_id_ancestry_chunks.length
            ? link_target_id_ancestry_chunks
            : lowest_node_id_ancestry_chunks;

        const target_link_is_in_branch_of_lowest_node = _.chain(
          shorter_of_the_id_chunks
        )
          .map((id_chunk, ix) => id_chunk === longer_of_the_id_chunks[ix])
          .reduce((memo, bool) => memo && bool, true)
          .value();

        return target_link_is_in_branch_of_lowest_node;
      })
      .value();

    const unfade_parent_polygons = polygon_selector => {
      this.graph_area
        .selectAll(polygon_selector)
        .data(links, polygon_key)
        .filter(d => (links.length > 0 ? _.includes(links, d) : true))
        .classed("faded", false)
        .classed("highlighted", true);
    };
    unfade_parent_polygons("polygon.partition-svg-link.root-polygon");
    unfade_parent_polygons("polygon.partition-svg-link");

    this.html
      .selectAll("div.partition-item")
      .data(data, content_key)
      .filter(d => (data.length > 0 ? _.includes(data, d) : true))
      .classed("faded", false);
  }

  render_popup(_node) {
    throw new Error("Not implemented");
  }

  add_pop_up(d) {
    if (_.isUndefined(d)) {
      return;
    }
    this.fade();
    select(d.DOM).node().focus();
    const content = select(d.DOM);
    let arrow_at_top;
    let pop_up_top;
    const pop_up = content
      .append("div")
      .classed("partition-popup", true)
      .style("border", `3px solid ${d.color}`)
      .style("left", 0.9 * d.DOM.offsetWidth + "px");
    // .style("color", d.color);

    this.render_popup(d, pop_up.node());

    pop_up.style("top", function (d) {
      let calculated_middle = (d.DOM.offsetHeight - this.offsetHeight) / 2;
      arrow_at_top = d.DOM.offsetTop + calculated_middle < 0;
      if (arrow_at_top) {
        calculated_middle = -30;
      }
      pop_up_top = calculated_middle;
      return calculated_middle + "px";
    });

    // Pointer triangle made with css
    const popup_pointer = pop_up
      .append("div")
      .attr("class", "popup-pointer")
      .style("visibility", "hidden");

    const pointer_height = popup_pointer.node().offsetHeight;

    popup_pointer
      .style(
        "top",
        -pop_up_top + d.DOM.offsetHeight / 2 - pointer_height / 2 - 3 + "px"
      )
      .style("visibility", "visible");

    const absolute_pop_up_left = d.DOM.offsetLeft + pop_up.node().offsetLeft;
    window.scroll(absolute_pop_up_left, window.pageYOffset);

    const to_be_highlighted = _.uniqBy(d.ancestors().concat(d.descendants()));
    this.unfade_popup_parents(to_be_highlighted);
    this.pop_up = d;
  }
  remove_pop_up() {
    select(this.pop_up.DOM).select(".partition-popup").remove();
    select(this.pop_up.DOM).node().focus();
    this.fade();
    this.unfade();
    this.svg
      .selectAll("polygon.partition-svg-link")
      .classed("highlighted", false);
    this.pop_up = false;
  }
  keydown_dispatch = () => {
    if (event.keyCode === 13) {
      this.click_dispatch();
    }
  };
  click_dispatch = () => {
    // hold a reference to the current target
    const target = select(event.target);
    // get a reference to the content
    let content = event.target.closest(".partition-item");
    if (_.isNull(content)) {
      if (target.classed("unmagnify-all")) {
        this.unmagnify_all();
        this.render();
      } else if (this.pop_up) {
        this.remove_pop_up();
      }
      // we're done with this event, ensure no further propogation
      event.stopImmediatePropagation();
      event.preventDefault();
      return;
    }
    if (
      this.pop_up &&
      !this.html.node().querySelector(".partition-popup").contains(event.target)
    ) {
      this.remove_pop_up();
      event.stopImmediatePropagation();
      event.preventDefault();
      return;
    }
    content = select(content);
    const d = content.datum();
    if (d.DOM.className.includes("faded")) {
      if (this.pop_up) {
        this.remove_pop_up();
      }
      event.stopImmediatePropagation();
      event.preventDefault();
      return;
    }
    if (
      d.data.hidden_children ||
      d.data.unhidden_children ||
      this.data.collapsed(d)
    ) {
      if (d.data.unhidden_children) {
        this.data.show_partial_children(d.parent);
      } else if (d.data.hidden_children) {
        this.data.show_all_children(d.parent);
      } else if (this.data.collapsed(d)) {
        this.data.unhide_all_children(d);
        this.magnify(d);
      }
      this.render();
      event.stopImmediatePropagation();
      event.preventDefault();
      return;
    }

    if (target.classed("partition-link-out")) {
      //do nothing and let route be processed
      return;
    } else if (target.classed("magnify")) {
      this.remove_pop_up();
      if (d.magnified) {
        this.unmagnify(d);
      } else {
        this.magnify(d);
      }
      this.render();
    } else if (d !== this.pop_up) {
      if (d === this.data.root && this.options.should_root_have_popup) {
        this.add_pop_up(d);
      } else {
        this.add_pop_up(d);
      }
    }
    event.stopImmediatePropagation();
    event.preventDefault();
  };
  unmagnify_all() {
    if (this.pop_up) {
      this.remove_pop_up();
    }

    _.each(this.data.root.children, node => {
      if (this.data.magnified(node)) {
        this.data.unmagnify(node);
      }
    });
    if (this.should_remove_unmagnify_all_button()) {
      this.remove_unmagnify_all_button();
    }
  }
  unmagnify(node) {
    this.data.unmagnify(node);
    if (this.should_remove_unmagnify_all_button()) {
      this.remove_unmagnify_all_button();
    }
  }
  magnify(node) {
    this.data.magnify(node);
    if (_.isUndefined(this.unmagnify_all_popup)) {
      this.add_unmagnify_all_button();
    }
  }
  add_unmagnify_all_button() {
    this.unmagnify_all_popup = this.html
      .append("div")
      .html("partition_unfocus_all_popup");
  }
  should_remove_unmagnify_all_button() {
    return (
      !_.isUndefined(this.unmagnify_all_popup) &&
      !this.are_any_children_magnified()
    );
  }
  are_any_children_magnified() {
    return _.chain(this.data.root.children)
      .map(node => node.magnified)
      .some()
      .value();
  }
  remove_unmagnify_all_button() {
    this.unmagnify_all_popup.remove();
    this.unmagnify_all_popup = undefined;
  }
  destructor() {
    // probable override?
    // consumer needs to call manually
  }
}

export class ManualPartitionDiagram extends BasePartitionDiagram {
  constructor(container, options) {
    super(container, options);
    this.popupCallback = this.options.popupCallback;
  }
  render_popup(node, container) {
    this.popupCallback(node, container);
  }
}

export class PartitionWithReactPopup extends BasePartitionDiagram {
  // can remove this if not using react-based pop-ups
  constructor(container, options) {
    super(container, options);
    this.reactAdapter = new ReactContentRenderer();
  }
  remove_pop_up() {
    this.reactAdapter.unmountAtNode(this.pop_up.DOM);
    super.remove_pop_up();
  }
  render_popup(node, container) {
    const PopupComponent = this.options.PopupComponent;
    const popupElement = React.createElement(PopupComponent, { node });
    this.reactAdapter.render(popupElement, container);
  }
  destructor() {
    super.destructor();
    this.reactAdapter.unmountAll();
  }
}
// export const PartitionWithReactPopup = _PartitionWithReactPopup;
