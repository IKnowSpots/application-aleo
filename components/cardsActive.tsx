/* eslint-disable @next/next/no-img-element */
"use client"
import Image from "next/image";
import { useState } from "react";
import { pauseEvent } from "@/utils"
import { currency } from "@/config"
import LoadingModal from "./LoadingModal";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { AleoWorker } from "@/src/workers/AleoWorker";

const CardsActive = ({ image, name, event_id, supply, setActiveEvents }: { image: any; name: string; event_id: any; supply: any, setActiveEvents: any }) => {

    const [loading, setLoading] = useState(false)

    function getValueOfField(recordString: string, fieldName: string) {
        try {
            // Look for the field in the string using a regular expression
            const regex = new RegExp(fieldName + "\\s*:\\s*([\\w\\.]+)");
            const match = regex.exec(recordString);

            if (match && match[1]) {
                return match[1].split('.')[0]; // Split at '.' and return the first part
            }
        } catch (error) {
            console.error('Error parsing record:', error);
        }
        return null;
    }

    const addRecordToPrivateRecords = (address: any, dataStr: any) => {
        const records = JSON.parse(localStorage.getItem('privateRecords') || "{}");
        records[address] = records[address] ? [...records[address], dataStr] : [dataStr];
        localStorage.setItem('privateRecords', JSON.stringify(records));
    };


    function updateRecordWhilePausing(event_id: any, new_state: any) {

        const events = JSON.parse(localStorage.getItem('eventsDetail') || "{}") || {};
        const modifiedEventId = event_id;

        // Find and update the specific event
        const updatedEvents = events.map((event: any) => {
            if (event.event_id === event_id) {
                return { ...event, status: new_state };
            }
            return event;
        });

        // Save the updated array back to local storage
        localStorage.setItem('eventsDetail', JSON.stringify(updatedEvents));

    }



    function searchRecordByEventId(records: any, event_id: any) {
        for (const address in records) {
            const matchedRecord = records[address].find((record: any) => getValueOfField(record, 'event_id') === event_id);
            if (matchedRecord) {
                return matchedRecord;
            }
        }
        return null;
    }

    // Delete a record by event ID
    function deleteRecordByEventId(records: any, event_id: any) {
        Object.keys(records).forEach(address => {
            records[address] = records[address].filter((record: any) => getValueOfField(record, 'event_id') !== event_id);
        });
    }


    function getARecordCorrespondingToAnEventCreation(event_id: any) {
        const records = JSON.parse(localStorage.getItem('privateRecords') || "{}") || {};
        const modifiedEventId = event_id + "field";
        const searchedEvent = searchRecordByEventId(records, modifiedEventId);

        if (searchedEvent == null) {
            throw new Error('Record with that event_id not found');
        } else {
            deleteRecordByEventId(records, modifiedEventId);
            localStorage.setItem('privateRecords', JSON.stringify(records));
            return searchedEvent;
        }
    }

    async function fetchDataUntilAvailable(url: any, maxAttempts = 10, delay = 10000) {
        try {
            const response = await fetch(url);
            if (response.ok) {
                const data = await response.json();
                // You can adjust this condition as needed, based on the expected data format
                if (data && !data.error) {
                    return data;
                }
            }
        } catch (error) {
            console.error("Error fetching data:", error);
        }

        if (maxAttempts <= 1) {
            throw new Error("Couldn't fetch data - something went wrong");
        }

        await new Promise(resolve => setTimeout(resolve, delay));

        return fetchDataUntilAvailable(url, maxAttempts - 1, delay);
    }


    const handlePausePrivateEvent: React.MouseEventHandler<HTMLButtonElement> = async (event_id) => {
        const aleoWorker = AleoWorker();
        // debugger;
        const param_event_id = event_id;

        let eventRecord;
        try {
            console.log("Before extracting the privateRecords =>", JSON.parse(localStorage.getItem('privateRecords') || "{}"));
            eventRecord = getARecordCorrespondingToAnEventCreation(param_event_id);
            console.log("After extracting => ", eventRecord);
            console.log("eventRecord corresponding to a eventID ", param_event_id, " => ", eventRecord);
        } catch (e) {
            console.error("Couldn't find a record corresponding to this eventID");
        }
        let ownerAddress = getValueOfField(eventRecord, "owner");
        const current_status = getValueOfField(eventRecord, "status");
        console.log("current_status => ", current_status);
        // console.log(`Executing toggle with eventID =  ${param_event_id} changing status from ${current_status}to ${!current_status}`);
        // setMsg(`Executing toggle with eventID =  ${param_event_id} changing status to ${selectedStatus}`);
        try {
            let program_name = "iknowspots_2.aleo";
            let function_name = "toggle_private_event";
            let statusu8;
            statusu8 = "0u8";

            if (eventRecord)
                console.log("statusu8 => ", statusu8)

            let tx_id;

            try {

                tx_id = await aleoWorker.execute(program_name, function_name, [eventRecord, statusu8]);
                // const transactionUrl = "http://localhost:3030/testnet3/transaction/" + tx_id;
            } catch (e) {
                console.error("something bad happened ", e);
            }

            const transactionUrl = "http://localhost:3030/testnet3/transaction/" + tx_id;
            console.log("transactionUrl => ", transactionUrl)

            const data = await fetchDataUntilAvailable(transactionUrl);
            console.log("fetched data ", data);
            const record = data.execution.transitions[0].outputs[0].value;
            console.log("record ", record);
            const decryptedRecord = await aleoWorker.decrypt_record(record);
            console.log("decryptedRecord => ", decryptedRecord);


            console.log("address in executeToggle ", ownerAddress);

            updateRecordWhilePausing(event_id, "0u8");


            setActiveEvents((events: any) => events.filter((event: any) => event.event_id !== event_id));
            addRecordToPrivateRecords(ownerAddress, decryptedRecord);

        } catch (error) {
            addRecordToPrivateRecords(ownerAddress, eventRecord);
            console.error("Error in createEvent function ", error);
        }

        // setMsg("");
    }



    const handlePausePublicEvent: React.MouseEventHandler<HTMLButtonElement> = async (event_id: any) => {
        const aleoWorker = AleoWorker();

        const toggled_state = "0u8";
        console.log("toggled_state =>", toggled_state);

        try {
            let program_name = "iknowspots_2.aleo";
            let function_name = "toggle_public_event";
            let statusu8;

            let tx_id;

            try {
                tx_id = await aleoWorker.execute(program_name, function_name, [event_id + "field", toggled_state]);
                // const transactionUrl = "http://localhost:3030/testnet3/transaction/" + tx_id;
            } catch (e) {
                console.error("something bad happened ", e);
            }

            const transactionUrl = "http://localhost:3030/testnet3/transaction/" + tx_id;
            console.log("transactionUrl => ", transactionUrl)

            const data = await fetchDataUntilAvailable(transactionUrl);
            console.log("fetched data ", data);
            setActiveEvents((events: any) => events.filter((event: any) => event.event_id !== event_id));
            updateRecordWhilePausing(event_id, "0u8");


        } catch (error) {
            console.error("Error in createEvent function ", error);
        }
        // setMsg("");
    }
    const handleResumePublicEvent: React.MouseEventHandler<HTMLButtonElement> = async (event_id: any) => {
        const aleoWorker = AleoWorker();


        const toggled_state = "1u8";
        console.log("toggled_state =>", toggled_state);


        console.log("final_state =>", toggled_state);

        try {
            let program_name = "iknowspots_2.aleo";
            let function_name = "toggle_public_event";
            let statusu8;

            let tx_id;

            try {

                tx_id = await aleoWorker.execute(program_name, function_name, [event_id + "field", toggled_state]);
                // const transactionUrl = "http://localhost:3030/testnet3/transaction/" + tx_id;
            } catch (e) {
                console.error("something bad happened ", e);
            }

            const transactionUrl = "http://localhost:3030/testnet3/transaction/" + tx_id;
            console.log("transactionUrl => ", transactionUrl)

            const data = await fetchDataUntilAvailable(transactionUrl);
            console.log("fetched data ", data);

        } catch (error) {
            console.error("Error in createEvent function ", error);
        }
        // setMsg("");
    }


    async function pauseEventCall(event_id: any) {
        const aleoWorker = AleoWorker();
        setLoading(true)
        console.log("event_id => ", event_id)
        const program_name = "iknowspots_2.aleo";
        const mapping_name = "event_id_hash_to_event_struct";
        const mapping_key = event_id.endsWith() == "field" ? event_id : event_id + "field";
        console.log("mapping_key => ", mapping_key);
        const mapping_value = await aleoWorker.getMappingValue(program_name, mapping_name, mapping_key);
        console.log("mapping_value => ", mapping_value);
        const is_private_event = getValueOfField(mapping_value, "is_private");
        console.log("is_private_event => ", is_private_event);
        is_private_event ? handlePausePrivateEvent(event_id) : handlePausePublicEvent(event_id);
        setActiveEvents((events: any) => events.filter((event: any) => event.event_id !== event_id));
        // if (function_to_call == true) {
        toast.success("Event Paused!", {
            position: "top-center",
            autoClose: 5000,
            hideProgressBar: true,
            closeOnClick: true,
            pauseOnHover: true,
            draggable: true,
            progress: undefined,
            theme: "dark",
        });
        // }
        setLoading(false)
    }

    return (
        <>
            <div className="text-white w-[23%] px-4 box-background pt-4 pb-5 rounded-xl">
                <div className="flex flex-col gap-6">
                    <img
                        src={image}
                        className="h-[250px] rounded-xl"
                        // width="195"
                        // height="200"
                        alt="Event&apos;s Image"
                    />
                    <div className="flex gap-2 text-[0.85rem] flex-col">
                        {/* <div className="flex justify-between items-center">
                            <p>{name}</p>
                            <p>{price} {currency}</p>
                        </div> */}
                        <div className="h-[2px] rounded-full bg-white"></div>
                        {/* <div className="flex justify-between items-center">
                            <p>Bought: {supply - remaining}</p>
                            <p>{date}</p>
                        </div> */}
                        {/* <p>{remaining}/{supply}</p> */}
                        {/* <p>1.20 Weth</p> */}
                        <div className="flex justify-center items-center">
                            <button className="view-btn px-4 py-0.5 outline rounded-lg" onClick={() => pauseEventCall(event_id)}>
                                Pause
                            </button>
                        </div>

                    </div>
                    {/* <hr />
                <div className="flex justify-between my-6">
                <p>End&apos;s In 01.34.45</p>
                <button className="px-4 py-1 outline rounded-lg">
                        Run
                    </button>
                </div> */}
                    <ToastContainer
                        position="top-center"
                        autoClose={5000}
                        hideProgressBar={false}
                        newestOnTop={false}
                        closeOnClick
                        rtl={false}
                        pauseOnFocusLoss
                        draggable
                        pauseOnHover
                        theme="dark"
                    />
                </div>
                {/* <ToastContainer
                position="top-center"
                autoClose={5000}
                hideProgressBar={false}
                newestOnTop={false}
                closeOnClick
                rtl={false}
                pauseOnFocusLoss
                draggable
                pauseOnHover
                theme="dark"
            /> */}
            </div>
        </>
    );
};
export default CardsActive;
