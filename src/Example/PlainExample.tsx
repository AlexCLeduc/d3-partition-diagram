import { hierarchy } from "d3-hierarchy";
import { select } from "d3-selection";
import _ from "lodash";

import React, { useEffect, useRef } from "react";

import { ManualPartitionDiagram } from "PartitionComponent/PartitionDiagram";

import {
  post_traversal_value_set,
  absolute_value_sort,
} from "PartitionComponent/util";

import { data as rawDataRoot, RawNode } from "./data";

export default function PlainExample() {
  return (
    <DumbComponent title="Plain Example">
      <PartitionComponent />
    </DumbComponent>
  );
}

interface ProcessedNode {
  data: RawNode;
  value: number;
  children: Array<ProcessedNode>;
}

function PartitionComponent() {
  //   return <div> {JSON.stringify(data)} </div>;
  const node = useRef(null);
  useEffect(() => {
    renderDiagram({ node: node.current });
  }, []);
  return <div ref={node} />;
}

function DumbComponent({ title, children }) {
  return (
    <div className="partition-page-root">
      <div className="partition-container">
        <h1 className="partition-title">{title}</h1>
      </div>
      {children}
    </div>
  );
}

// NO REACT BELOW THIS POINT

function renderDiagram({ node }) {
  /* 
    THIS IS THE NON-REACT ENTRYPOINT
  */
  const containerSelection = select(node);
  const partitionDiagram = new ManualPartitionDiagram(containerSelection, {
    popupCallback: popupHtmlForNode,
    height: 700,
  });

  // todo: shape data
  const partitionData = getData();

  partitionDiagram.configure_then_render({
    data: partitionData,
    data_wrapper_node_rules: data_wrapper_node_rules,
    dont_fade: [],
    html_func: htmlForNode,
    should_root_have_popup: true,
    // formatter: node => ` (${node.value})`,
    level_headers: [null, "VP", "Director General", "Director", "Employee"],
    colors: branchColors,
    background_color: backgroundColor,
  });
}

function popupHtmlForNode(node: ProcessedNode, container: HTMLElement) {
  const html = `
    <div className="consumer-popup">
        <div>${node.data.name}</div>
        <div>${node.value}</div>
    </div>
  `;
  container.innerHTML = html;
}

function htmlForNode(node: ProcessedNode) {
  return `<span style="font-size: 14px;">${node.data.name}</span>`;
}

const branchColors = [
  // partition is colored by branch, not by layer
  "#195596", // blue
  "#117078", // dark teal
  "#862552", // pink
  "#554A9E", // purple
  "#1B793A", // green
  "#555B62", // grey
];
const backgroundColor = "#26374A";

function data_wrapper_node_rules(node) {
  node.__value__ = node.value;
  node.open = true;
  if (node.data.root) {
    node.how_many_to_show = _node => [_node.children, []];
  } else if (!_.isEmpty(node.children)) {
    const root_value = _.last(node.ancestors()).value;

    node.how_many_to_show = function (_node) {
      if (_node.children.length === 2) {
        return [_node.children, []];
      }
      const show = [_.head(_node.children)];
      const hide = _.tail(_node.children);
      const unhide = _.filter(
        hide,
        __node => Math.abs(__node.value) > root_value / 50
      );
      return [show.concat(unhide), _.difference(hide, unhide)];
    };
  }
}

function getData() {
  const valueFunc = node => node.amount;
  return hierarchy(rawDataRoot, node => node.children)
    .eachAfter(node => {
      post_traversal_value_set(node, valueFunc);
    })
    .sort(absolute_value_sort);
}
