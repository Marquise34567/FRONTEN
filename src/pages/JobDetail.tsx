import { Navigate, useParams } from "react-router-dom";

const JobDetail = () => {
  const { id } = useParams();
  if (!id) return <Navigate to="/editor" replace />;
  return <Navigate to={`/editor?jobId=${encodeURIComponent(id)}`} replace />;
};

export default JobDetail;
