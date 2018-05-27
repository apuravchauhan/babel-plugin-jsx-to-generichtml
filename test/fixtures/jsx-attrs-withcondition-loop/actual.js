import { Custom } from './comp1';
class Foo extends React.Component {
  render({ a, b, c }) {
    return (<div>
      {a.value == true && b != false &&
        <span class={b}>this is {a.value}</span>
      }
      {c.map(d => {
        return <span>loop</span>
      })
      }
    </div>);
  }
}
