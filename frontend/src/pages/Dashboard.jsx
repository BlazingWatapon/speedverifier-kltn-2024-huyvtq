import React, { useState, useEffect } from "react";
import Header from "../components/Header";
import "./Dashboard.css";
import { MdOutlineMailOutline } from "react-icons/md";
import { IoIosInformationCircleOutline } from "react-icons/io";
import verifyIcon from "./../assets/Images/email-icon.png";
import { Link } from "react-router-dom";
import { IoPieChartOutline } from "react-icons/io5";
import PieChart from "../components/PieChart";
import axios from "axios";
import { FaSquare } from "react-icons/fa";

function Dashboard({ userId }) {
  const [email, setEmail] = useState("");
  const [totalValidations, setTotalValidations] = useState(0);
  const [chartData, setChartData] = useState({
    labels: [
      "Valid",
      "Not Existed",
      "Block",
      "Full",
      "Syntax Error",
      "Unknown",
    ],
    datasets: [
      {
        data: [0, 0, 0, 0, 0, 0],
        backgroundColor: [
          "#41B06E",
          "#526D82",
          "#D21312",
          "#FFD700",
          "#6962AD",
          "#213547",
        ],
        borderColor: "#ffffff",
        borderWidth: 2,
      },
    ],
  });

  useEffect(() => {
    const fetchTotalValidations = async () => {
      try {
        const response = await axios.get(
          `http://localhost:5000/api/total-validations/${userId}`
        );
        setTotalValidations(response.data.totalValidations);
      } catch (error) {
        console.error("Error fetching total validations:", error);
      }
    };

    const fetchChartData = async () => {
      try {
        const response = await axios.get(
          `http://localhost:5000/api/status-data/${userId}`
        );
        const statusData = response.data;

        const statusOrder = [
          "Valid",
          "Not Existed",
          "Block",
          "Full",
          "Syntax Error",
          "Unknown",
        ];
        const dataMap = statusOrder.reduce((acc, status) => {
          acc[status] = 0;
          return acc;
        }, {});

        statusData.forEach((item) => {
          const status = item.status.replace(/[-\s]/g, " ").toLowerCase(); // Normalize status
          const formattedStatus = status
            .split(" ")
            .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
            .join(" ");
          if (dataMap.hasOwnProperty(formattedStatus)) {
            dataMap[formattedStatus] = item.count;
          }
        });

        const total = Object.values(dataMap).reduce(
          (sum, count) => sum + count,
          0
        );
        const percentages = statusOrder.map((status) =>
          ((dataMap[status] / total) * 100).toFixed(2)
        );

        setChartData((prevState) => ({
          ...prevState,
          datasets: [
            {
              ...prevState.datasets[0],
              data: percentages,
            },
          ],
        }));
      } catch (error) {
        console.error("Error fetching status data:", error);
      }
    };

    fetchTotalValidations();
    fetchChartData();
  }, [userId]);

  const handleGoClick = async () => {
    try {
      const response = await axios.post("http://localhost:5000/api/validate", {
        email,
        userId,
      });
      const { status, code } = response.data;
      alert("Email you enter is: " + status + "\n status code: " + code);
      window.location.reload(); // Reload the page after showing the alert
    } catch (error) {
      console.error("Error:", error);
    }
  };

  return (
    <div className="content">
      <Header title="Dashboard" />
      <div className="welcome-message">Welcome back!</div>
      <div className="boxes">
        <div className="box">
          <div className="vertical-1">
            <div className="box-header">
              <div className="icon-box">
                <MdOutlineMailOutline className="icon" />
              </div>
              <div className="validation-info">
                <div className="validate-text">Validate</div>
                <div className="info-icon">
                  <IoIosInformationCircleOutline className="information-icon" />
                  <div className="info-tooltip">
                    Type in an email address and press "Go" to quickly validate
                    a single email address
                  </div>
                </div>
              </div>
            </div>
            <div className="box-body">
              <div className="line-1">SINGLE MAIL VALIDATION</div>
              <div className="email-action">
                <input
                  type="email"
                  placeholder="email@example.com"
                  className="email-input"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
                <button className="go-button" onClick={handleGoClick}>
                  Go
                </button>
              </div>
              <div className="validate-list">
                <div className="line-2">or validate an entire list</div>
                <Link to={`/validate/${userId}`}>
                  <button className="validate-list-button">
                    Validate New List
                  </button>
                </Link>
              </div>
              <div className="status">
                <div className="line-3">Status</div>
                <div className="status-grid">
                  <div className="status-item">
                    <FaSquare className="status-icon valid-icon" />
                    <div className="status-text" data-status="valid">
                      Valid
                      <div className="info-status">
                        Email address you entered is valid and ready to receive
                        mail
                      </div>
                    </div>
                  </div>
                  <div className="status-item">
                    <FaSquare className="status-icon not-existed-icon" />
                    <div className="status-text" data-status="not-existed">
                      Not Existed
                      <div className="info-status">
                        Email address you entered does not exist
                      </div>
                    </div>
                  </div>
                  <div className="status-item">
                    <FaSquare className="status-icon block-icon" />
                    <div className="status-text" data-status="block">
                      Block
                      <div className="info-status">
                        Email address you entered is disabled by SMTP provider
                      </div>
                    </div>
                  </div>
                  <div className="status-item">
                    <FaSquare className="status-icon full-icon" />
                    <div className="status-text" data-status="full">
                      Full
                      <div className="info-status">
                        Email address you entered is out of inbox's storage
                      </div>
                    </div>
                  </div>
                  <div className="status-item">
                    <FaSquare className="status-icon syntax-error-icon" />
                    <div className="status-text" data-status="syntax-error">
                      Syntax Error
                      <div className="info-status">
                        We couldn't find the recipient's domain name or email
                        address you entered that contains special characters.
                        Check for any spelling errors
                      </div>
                    </div>
                  </div>
                  <div className="status-item">
                    <FaSquare className="status-icon unknown" />
                    <div className="status-text" data-status="unknown">
                      Unknown
                      <div className="info-status">
                        We were unable to check the email address you entered
                        for some unspecified reason. Please check the error code
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="vertical-2">
            <img src={verifyIcon} alt="Verification Icon" />
            <div>
              <div className="get-total-validation">{totalValidations}</div>
              <div className="line">TOTAL VALIDATIONS</div>
            </div>
          </div>
        </div>
        <div className="box-2">
          <div className="overview-header">
            <div className="overview-icon-box">
              <IoPieChartOutline className="overview-icon" />
            </div>
            <div className="overview-info">
              <div className="overview-text">Overview</div>
              <div className="overview-info-icon">
                <IoIosInformationCircleOutline className="overview-information-icon" />
                <div className="overview-info-tooltip">
                  Displays your overview report
                </div>
              </div>
            </div>
          </div>
          <div className="overview-display">
            <div className="piechart">
              <PieChart data={chartData} />
            </div>
            <div className="statistics">
              <div className="box-2-status-item">
                <div className="status-line">STATUS</div>
                <div className="percent-line">% OF EMAILS</div>
              </div>
              {chartData.labels.map((label, index) => (
                <div className="box-2-status-item" key={index}>
                  <div className="box-2-status-text">{label}</div>
                  <div
                    className={`percent-${label
                      .toLowerCase()
                      .replace(/\s+/g, "-")}`}
                  >
                    {chartData.datasets[0].data[index]}%
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="entire-history">
            <div className="history-line">or view your entire history</div>
            <Link to={`/history/${userId}`}>
              <button className="view-history-button">
                View Entire History
              </button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
