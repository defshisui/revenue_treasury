import { useNavigate } from "react-router-dom";


interface Props {
  title: string;
  description: string;
  path?: string;
  tag?: boolean;
}


export default function ServiceCard({
  title,
  description,
  path,
  tag = true
}: Props) {

  const navigate = useNavigate();


  return (
    <div
      className="lgu-service-card cursor-pointer"
      onClick={() => path && navigate(path)}
    >

      <h2 className="lgu-service-title">
        {title}
      </h2>


      <div className="lgu-service-description">
        {description}
      </div>


      {tag && (
        <span className="lgu-service-tag">
          Admin Control
        </span>
      )}

    </div>
  );
}