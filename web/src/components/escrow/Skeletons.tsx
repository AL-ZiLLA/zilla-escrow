export function Skeletons() {
  return <div className="esc-skeleton" role="status" aria-label="Loading agreement"><div className="esc-skeleton-title"/><div className="esc-money">{[0,1,2,3].map(i => <div key={i}><div/><div/></div>)}</div>{[0,1,2,3].map(i => <div className="esc-skeleton-card" key={i}/>)}</div>;
}
