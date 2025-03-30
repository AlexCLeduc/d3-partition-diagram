# What is this
[demo](https://alexcleduc.github.io/d3-partition-diagram/)
This is a "partition diagram", an accordion to visualize the scale of a hierarchy:

![Screenshot 2025-03-30 at 12 14 21](https://github.com/user-attachments/assets/9dd96feb-d902-49c2-bd2b-d88825f89de1)

It was created by Andrew Gibson in 2018, inspired by a visualization seen on [usafacts](https://usafacts.org/government-spending/) for [GCInfobase](https://canada.ca/gcinfobase)

It was later retired from GCInfobase, turned into a react-component, and years later published here on github for anyone to use. 

It was non-trivial to create a reusable package of of this component. It is heavily coupled to particular usecases (e.g. required very large viewport). Until there is enough appetite for componentization, this repo will remain as an exmaple you can copy and paste into your own project.

For legacy reasons, this repo is a "create react app". React is not a required dependency, the visualization only requires a few d3 packages and lodash (which is easily replaced w/ vanilla JS).

# Local dev

```bash
npm i
npm start
```
