import { Link } from "react-router-dom"

export default function Navbar() {

  return (

    <nav className="lgu-navbar">

      <div className="lgu-navbar-brand">

        Admin Profile

      </div>

      <ul className="lgu-navbar-menu">

        <li>

          <Link to="/legacy-treasury" className="lgu-nav-link">

            Back to Dashboard

          </Link>

        </li>

      </ul>

    </nav>

  )

} 