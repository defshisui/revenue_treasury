import AdminNavbar from "../components/AdminNavbar";
import AdminSidebar from "../components/AdminSidebar";
import Footer from "../components/Footer";


interface AdminLayoutProps {

    children: React.ReactNode;

}



export default function AdminLayout({
    children
}:AdminLayoutProps){


    return (

        <div className="admin-layout">


            <AdminNavbar />


            <div className="admin-body">


                <AdminSidebar />


                <main className="admin-content">

                    {children}

                </main>


            </div>


            <Footer />


        </div>

    )

}