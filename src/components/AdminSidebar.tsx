import { useNavigate } from "react-router-dom";

export default function AdminSidebar() {

    const navigate = useNavigate();

    return (
        <aside className="admin-sidebar">

            <div className="admin-sidebar-title">
                LGU Revenue System
            </div>


            <nav className="admin-menu">

                <a className="admin-menu-item">
                    Dashboard
                </a>


                <p className="admin-menu-section">
                    Revenue Management
                </p>


                <a className="admin-menu-item">
                    Real Property Tax
                </a>

                <button
                    onClick={() => navigate("/business-tax")}
                    className="admin-menu-item">
                    Business Tax
                </button>

                <a className="admin-menu-item">
                    Regulatory Fees
                </a>

                <a className="admin-menu-item">
                    Market Rental
                </a>


                <p className="admin-menu-section">
                    Treasury
                </p>


                <a className="admin-menu-item">
                    Payments
                </a>

                <a className="admin-menu-item">
                    Receipts
                </a>


                <p className="admin-menu-section">
                    System
                </p>


                <a className="admin-menu-item">
                    Reports
                </a>

                <a className="admin-menu-item">
                    User Management
                </a>

                <a className="admin-menu-item">
                    Audit Logs
                </a>


            </nav>

        </aside>
    )
}