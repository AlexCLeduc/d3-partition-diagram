import { sum } from "d3-array";
import _ from "lodash";
import ReactDOM from "react-dom";

export const absolute_value_sort = (a, b) =>
  -(Math.abs(a.value) - Math.abs(b.value));

export const alphabetic_name_sort = (a, b) =>
  a.data.name.toLowerCase().localeCompare(b.data.name.toLowerCase());

export function post_traversal_value_set(node, get_val) {
  if (_.isEmpty(node.children)) {
    node.value = get_val(node.data) || 0;
  } else {
    node.children = _.filter(
      node.children,
      d => d.value !== false && d.value !== 0
    );
    node.value = sum(node.children, d => d.value);
  }
}

export class ReactContentRenderer {
  // used to cleanup react memory leaks
  constructor() {
    this.nodes = [];
  }
  render(component, node) {
    ReactDOM.render(component, node);
    this.nodes.push(node);
  }
  unmountAll() {
    _.each(this.nodes, node => ReactDOM.unmountComponentAtNode(node));
    this.nodes = [];
  }
  unmountAtNode(node) {
    ReactDOM.unmountComponentAtNode(node);
    this.nodes = this.nodes.filter(n => n === node);
  }
}
